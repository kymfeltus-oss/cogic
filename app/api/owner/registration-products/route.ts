import { NextResponse } from "next/server";
import { DEFAULT_PROGRAM_KEY } from "@/lib/registration/types";
import { ENTITLEMENT_TYPES } from "@/lib/registration/entitlements";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const keyPattern = /^[A-Z][A-Z0-9_]{1,63}$/;

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const admin = getSupabaseAdmin();
  const [products, entitlements, assignments] = await Promise.all([
    admin.from("registration_products").select("*").eq("program_key", DEFAULT_PROGRAM_KEY).order("sort_order"),
    admin.from("access_entitlements").select("*").eq("program_key", DEFAULT_PROGRAM_KEY).order("name"),
    admin.from("registration_product_entitlements").select("id,registration_product_id,entitlement_id,quantity,active,rule_config"),
  ]);
  if (products.error || entitlements.error || assignments.error) return NextResponse.json({ error: "Unable to load registration access configuration." }, { status: 500 });
  return NextResponse.json({ products: products.data ?? [], entitlements: entitlements.data ?? [], assignments: assignments.data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const kind = text(body?.kind, 24);
  const admin = getSupabaseAdmin();

  if (kind === "product") {
    const productKey = text(body?.productKey, 64).toUpperCase();
    const name = text(body?.name, 120);
    const priceCents = Number(body?.priceCents);
    if (!keyPattern.test(productKey) || !name || !Number.isInteger(priceCents) || priceCents < 0) return NextResponse.json({ error: "Valid product key, name, and non-negative price are required." }, { status: 400 });
    const capacity = body?.capacity === "" || body?.capacity == null ? null : Number(body.capacity);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 0)) return NextResponse.json({ error: "Capacity must be a non-negative whole number." }, { status: 400 });
    const { data, error } = await admin.from("registration_products").insert({ program_key: DEFAULT_PROGRAM_KEY, product_key: productKey, name, description: text(body?.description) || null, eligibility_description: text(body?.eligibilityDescription) || null, price_cents: priceCents, registration_opens_at: text(body?.registrationOpensAt, 40) || null, registration_closes_at: text(body?.registrationClosesAt, 40) || null, capacity, badge_type: text(body?.badgeType, 80) || null, active: body?.active !== false, public: body?.public === true, sort_order: Number.isInteger(Number(body?.sortOrder)) ? Number(body?.sortOrder) : 0, created_by: auth.userId, updated_by: auth.userId }).select("*").single();
    return error ? NextResponse.json({ error: "Unable to create product." }, { status: 400 }) : NextResponse.json({ product: data }, { status: 201 });
  }

  if (kind === "entitlement") {
    const entitlementKey = text(body?.entitlementKey, 64).toUpperCase();
    const name = text(body?.name, 120);
    const entitlementType = text(body?.entitlementType, 30);
    if (!keyPattern.test(entitlementKey) || !name || !ENTITLEMENT_TYPES.includes(entitlementType as never)) return NextResponse.json({ error: "Valid entitlement key, name, and controlled type are required." }, { status: 400 });
    const hold = body?.preferredHoldMinutes === "" || body?.preferredHoldMinutes == null ? null : Number(body.preferredHoldMinutes);
    if (hold !== null && (!Number.isInteger(hold) || hold < 0)) return NextResponse.json({ error: "Preferred hold must be a non-negative whole number." }, { status: 400 });
    const usageLimit = body?.usageLimit === "" || body?.usageLimit == null ? null : Number(body.usageLimit);
    if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) return NextResponse.json({ error: "Usage limit must be a positive whole number." }, { status: 400 });
    const { data, error } = await admin.from("access_entitlements").insert({ program_key: DEFAULT_PROGRAM_KEY, entitlement_key: entitlementKey, name, description: text(body?.description) || null, entitlement_type: entitlementType, event_type: text(body?.eventType, 64) || null, event_id: text(body?.eventId, 64) || null, event_occurrence_id: text(body?.eventOccurrenceId, 64) || null, venue_key: text(body?.venueKey, 64) || null, access_zone: text(body?.accessZone, 64) || null, valid_from: text(body?.validFrom, 40) || null, valid_until: text(body?.validUntil, 40) || null, preferred_hold_minutes: hold, usage_limit: usageLimit, guardian_required: body?.guardianRequired === true, single_use: body?.singleUse === true, active: body?.active !== false, created_by: auth.userId, updated_by: auth.userId }).select("*").single();
    return error ? NextResponse.json({ error: "Unable to create entitlement." }, { status: 400 }) : NextResponse.json({ entitlement: data }, { status: 201 });
  }

  if (kind === "assignment") {
    const productId = text(body?.productId, 64);
    const entitlementId = text(body?.entitlementId, 64);
    if (!productId || !entitlementId) return NextResponse.json({ error: "Product and entitlement are required." }, { status: 400 });
    const { data, error } = await admin.from("registration_product_entitlements").upsert({ registration_product_id: productId, entitlement_id: entitlementId, quantity: Math.max(1, Number(body?.quantity) || 1), active: true }, { onConflict: "registration_product_id,entitlement_id" }).select("*").single();
    return error ? NextResponse.json({ error: "Unable to assign entitlement." }, { status: 400 }) : NextResponse.json({ assignment: data }, { status: 201 });
  }
  return NextResponse.json({ error: "Unsupported configuration operation." }, { status: 400 });
}

export async function PATCH(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const kind = text(body?.kind, 24);
  const id = text(body?.id, 64);
  const active = body?.active;
  const isPublic = body?.public;
  if (!id) return NextResponse.json({ error: "A configuration ID is required." }, { status: 400 });
  const table = kind === "product" ? "registration_products" : kind === "entitlement" ? "access_entitlements" : kind === "assignment" ? "registration_product_entitlements" : null;
  if (!table) return NextResponse.json({ error: "Unsupported configuration operation." }, { status: 400 });
  if (typeof active !== "boolean" && !(kind === "product" && typeof isPublic === "boolean")) return NextResponse.json({ error: "Provide an active state or product visibility state." }, { status: 400 });
  const updates: Record<string, unknown> = kind === "assignment" ? {} : { updated_by: auth.userId };
  if (typeof active === "boolean") updates.active = active;
  if (kind === "product" && typeof isPublic === "boolean") updates.public = isPublic;
  const query = getSupabaseAdmin().from(table).update(updates).eq("id", id);
  if (kind !== "assignment") query.eq("program_key", DEFAULT_PROGRAM_KEY);
  const { error } = await query;
  return error ? NextResponse.json({ error: "Unable to update configuration." }, { status: 400 }) : NextResponse.json({ ok: true });
}
