import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import { attemptRegistrationCredentialIssuance } from "@/lib/registration/post-fulfillment";
import { DEFAULT_PROGRAM_KEY, REGISTRATION_CHECKOUT_TYPE } from "@/lib/registration/types";
import { confirmPaidGroup } from "@/lib/registration/slice2-repository";

export type RegistrationWebhookFulfillmentResult =
  | {
      ok: true;
      idempotent: boolean;
      registrationId: string;
      credentialIssued: boolean;
      credentialJobEnqueued?: boolean;
    }
  | { ok: false; status: number; error: string };

function readRegistrationMetadata(session: Stripe.Checkout.Session): {
  registrationId: string;
  programKey: string;
} | null {
  const registrationId = session.metadata?.registration_id?.trim() ?? "";
  const programKey = session.metadata?.program_key?.trim() ?? "";
  const checkoutType = session.metadata?.checkout_type?.trim() ?? "";

  if (checkoutType !== REGISTRATION_CHECKOUT_TYPE) {
    return null;
  }

  if (!registrationId || !programKey) {
    return null;
  }

  return { registrationId, programKey };
}

export async function fulfillRegistrationCheckoutFromWebhook(input: {
  session: Stripe.Checkout.Session;
  supabaseAdmin: SupabaseClient;
}): Promise<RegistrationWebhookFulfillmentResult> {
  const metadata = readRegistrationMetadata(input.session);

  if (!metadata) {
    return {
      ok: false,
      status: 422,
      error: "Registration checkout metadata missing.",
    };
  }

  if (metadata.programKey !== DEFAULT_PROGRAM_KEY) {
    return {
      ok: false,
      status: 422,
      error: "Registration checkout program key mismatch.",
    };
  }

  const paymentIntentId =
    typeof input.session.payment_intent === "string"
      ? input.session.payment_intent
      : input.session.payment_intent?.id ?? null;

  const actorUserId = input.session.client_reference_id ?? null;

  const { data, error } = await input.supabaseAdmin.rpc("fulfill_registration_checkout", {
    p_stripe_session_id: input.session.id,
    p_stripe_payment_intent_id: paymentIntentId,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (error.code === "23505" || message.includes("duplicate")) {
      // Idempotent payment path still recovers group sync + credential queue.
      const credentialIssued = await confirmPaidGroup(metadata.registrationId, actorUserId);
      return {
        ok: true,
        idempotent: true,
        registrationId: metadata.registrationId,
        credentialIssued,
        credentialJobEnqueued: !credentialIssued,
      };
    }

    return {
      ok: false,
      status: 500,
      error: error.message,
    };
  }

  const payload = (data ?? {}) as { idempotent?: boolean; registration_id?: string };
  const registrationId = payload.registration_id ?? metadata.registrationId;

  // Primary may already be confirmed by fulfill RPC; sync siblings atomically then issue/queue.
  const groupCredentialsReady = await confirmPaidGroup(registrationId, actorUserId);

  // Ensure the paid primary itself is covered even if group RPC returned no members.
  const primaryCredential = await attemptRegistrationCredentialIssuance({
    registrationId,
    actorUserId,
  });

  const credentialIssued =
    groupCredentialsReady || primaryCredential.issued || primaryCredential.idempotent;
  const credentialJobEnqueued = primaryCredential.retryQueued === true || !credentialIssued;

  return {
    ok: true,
    idempotent: payload.idempotent === true,
    registrationId,
    credentialIssued,
    credentialJobEnqueued,
  };
}
