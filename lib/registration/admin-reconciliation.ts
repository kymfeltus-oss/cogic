import "server-only";

import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/checkout/server";
import { mapDatabaseError, RegistrationError } from "@/lib/registration/errors";
import { fulfillRegistrationCheckoutFromWebhook } from "@/lib/registration/stripe-webhook";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function notes(value: string) {
  const result = value.trim();
  if (result.length < 8) throw new RegistrationError("validation", "Reconciliation notes of at least 8 characters are required.");
  return result.slice(0, 500);
}

async function loadContext(registrationId: string) {
  const db = getSupabaseAdmin();
  const { data: registration, error } = await db.from("registrations")
    .select("id,registration_group_id,row_version,status").eq("id", registrationId).maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!registration) throw new RegistrationError("not_found", "Registration not found.");
  const [{ data: payment }, { data: group }, { data: members }] = await Promise.all([
    db.from("registration_payments").select("id,status,stripe_session_id,stripe_payment_intent_id").eq("registration_id", registrationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    registration.registration_group_id ? db.from("registration_groups").select("id,row_version").eq("id", registration.registration_group_id).maybeSingle() : Promise.resolve({ data: null }),
    registration.registration_group_id ? db.from("registrations").select("id,row_version").eq("registration_group_id", registration.registration_group_id) : Promise.resolve({ data: [] }),
  ]);
  return { registration, payment, group, members: members ?? [] };
}

export async function reconcileRegistrationPayment(input: {
  action: "verify_stripe" | "retry_webhook" | "offline_check";
  registrationId: string;
  actorUserId: string;
  notes: string;
  reference?: string;
}) {
  const reconciliationNotes = notes(input.notes);
  const context = await loadContext(input.registrationId.trim());
  const db = getSupabaseAdmin();

  if (input.action === "offline_check") {
    if (!context.group) throw new RegistrationError("conflict", "Offline check reconciliation requires a registration group.");
    const { data, error } = await db.rpc("record_offline_check_registration", {
      p_actor_user_id: input.actorUserId,
      p_registration_id: context.registration.id,
      p_reference: input.reference?.trim() ?? "",
      p_notes: reconciliationNotes,
      p_expected_group_version: Number(context.group.row_version),
      p_expected_member_versions: Object.fromEntries(context.members.map((member) => [member.id, Number(member.row_version)])),
    });
    if (error) throw mapDatabaseError(error);
    return { action: input.action, ...(data as Record<string, unknown>) };
  }

  if (!context.payment?.stripe_session_id) throw new RegistrationError("not_found", "No Stripe Checkout Session is recorded for this registration.");
  const secret = getStripeSecretKey();
  if (!secret) throw new RegistrationError("unavailable", "Payment processing is not configured.");
  const stripe = new Stripe(secret);
  const session = await stripe.checkout.sessions.retrieve(context.payment.stripe_session_id, { expand: ["payment_intent"] });
  const verified = session.payment_status === "paid" && session.status === "complete";
  if (!verified) throw new RegistrationError("conflict", "Stripe has not confirmed this Checkout Session as paid and complete.");

  let outcome: "verified" | "fulfilled" = "verified";
  if (input.action === "retry_webhook") {
    const result = await fulfillRegistrationCheckoutFromWebhook({ session, supabaseAdmin: db });
    if (result.ok === false) throw new RegistrationError(result.status === 409 ? "conflict" : "unavailable", result.error);
    outcome = "fulfilled";
  }
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const { data: audit, error: auditError } = await db.from("registration_reconciliations").insert({
    registration_id: context.registration.id,
    group_id: context.registration.registration_group_id,
    payment_id: context.payment.id,
    action: input.action === "verify_stripe" ? "stripe_verify" : "webhook_replay",
    outcome,
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    notes: reconciliationNotes,
    actor_user_id: input.actorUserId,
    metadata: { stripe_payment_status: session.payment_status, stripe_session_status: session.status },
  }).select("id,action,outcome,created_at").single();
  if (auditError) throw mapDatabaseError(auditError);
  return { ok: true, action: input.action, outcome, stripeSessionId: session.id, reconciliation: audit };
}
