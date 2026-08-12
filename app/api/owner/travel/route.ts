/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { retiredOwnerActionDisposition } from "@/lib/owner/retired-actions";
import { requireOwnerUser } from "@/lib/owner/auth";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { marketplaceStatus } from "@/lib/travel/providers";
import {
  isStaleMarketplaceAttempt,
  listOwnerMarketplaceAttempts,
  marketplaceExceptionQueues,
} from "@/lib/travel/marketplace/booking";
import {
  listOwnerBookingTransactions,
  listRecentTransactionEvents,
} from "@/lib/travel/ops/ledger";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";

const clean = (v: unknown, n = 1000) => String(v ?? "").trim().slice(0, n) || null;

export async function GET(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const db = getSupabaseAdmin();
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim().toLowerCase() || "";
  const marketplaceUserId = params.get("marketplaceUserId")?.trim() || "";
  const marketplaceProvider = params.get("marketplaceProvider") || "";
  const marketplaceKind = params.get("marketplaceKind") || "";
  const marketplaceBookingStatus = params.get("marketplaceStatus") || "";
  const marketplaceDateFrom = params.get("marketplaceDateFrom") || "";
  const marketplaceDateTo = params.get("marketplaceDateTo") || "";
  const marketplaceStaleOnly = params.get("marketplaceStaleOnly") === "1";
  const marketplaceSort = params.get("marketplaceSort") || "started_at_desc";
  const amountMinRaw = params.get("marketplaceAmountMinCents");
  const amountMaxRaw = params.get("marketplaceAmountMaxCents");
  const marketplaceAmountMinCents =
    amountMinRaw != null && amountMinRaw !== "" && Number.isFinite(Number(amountMinRaw))
      ? Math.round(Number(amountMinRaw))
      : null;
  const marketplaceAmountMaxCents =
    amountMaxRaw != null && amountMaxRaw !== "" && Number.isFinite(Number(amountMaxRaw))
      ? Math.round(Number(amountMaxRaw))
      : null;
  const readiness = marketplaceStatus();

  const [
    hotels,
    events,
    res,
    airports,
    transport,
    announcements,
    marketplaceAttempts,
    bookingTransactions,
  ] = await Promise.all([
      db
        .from("travel_hotels")
        .select("*,travel_hotel_room_types(*,travel_hotel_nightly_availability(*))")
        .eq("program_key", TRAVEL_PROGRAM_KEY)
        .order("display_order"),
      db
        .from("travel_analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("program_key", TRAVEL_PROGRAM_KEY),
      db
        .from("travel_hotel_reservations")
        .select("*,travel_hotels(name)")
        .eq("program_key", TRAVEL_PROGRAM_KEY)
        .order("created_at", { ascending: false }),
      db
        .from("travel_airports")
        .select("*")
        .eq("program_key", TRAVEL_PROGRAM_KEY)
        .order("display_order"),
      db
        .from("travel_transportation_options")
        .select("*")
        .eq("program_key", TRAVEL_PROGRAM_KEY)
        .order("display_order"),
      db
        .from("travel_announcements")
        .select("*")
        .eq("program_key", TRAVEL_PROGRAM_KEY)
        .order("published_at", { ascending: false }),
      listOwnerMarketplaceAttempts({
        // Apply free-text `q` after email enrichment so attendee email search works.
        userId: marketplaceUserId || undefined,
        provider: marketplaceProvider || undefined,
        kind: marketplaceKind || undefined,
        status: marketplaceBookingStatus || undefined,
        dateFrom: marketplaceDateFrom || undefined,
        dateTo: marketplaceDateTo || undefined,
        amountMinCents: marketplaceAmountMinCents,
        amountMaxCents: marketplaceAmountMaxCents,
        staleOnly: marketplaceStaleOnly || undefined,
        sort: marketplaceSort || undefined,
      }),
      listOwnerBookingTransactions({
        userId: marketplaceUserId || undefined,
        provider: marketplaceProvider || undefined,
        kind: marketplaceKind || undefined,
        status: marketplaceBookingStatus || undefined,
        dateFrom: marketplaceDateFrom || undefined,
        dateTo: marketplaceDateTo || undefined,
        amountMinCents: marketplaceAmountMinCents,
        amountMaxCents: marketplaceAmountMaxCents,
        sort: marketplaceSort || undefined,
      }),
    ]);

  const enriched = await Promise.all(
    (res.data ?? []).map(async (r: any) => {
      const { data } = await db.auth.admin.getUserById(r.user_id);
      return { ...r, attendee_email: data.user?.email ?? null };
    }),
  );
  const reservations = q
    ? enriched.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
    : enriched;

  const now = Date.now();
  const marketplaceWithEmailRaw = await Promise.all(
    marketplaceAttempts.map(async (attempt) => {
      const { data } = await db.auth.admin.getUserById(attempt.user_id);
      return {
        id: attempt.id,
        user_id: attempt.user_id,
        kind: attempt.kind,
        provider_key: attempt.provider_key,
        status: attempt.status,
        offer_id: attempt.offer_id,
        provider_offer_ref: attempt.provider_offer_ref,
        destination_label: attempt.destination_label,
        origin_label: attempt.origin_label,
        start_at: attempt.start_at,
        end_at: attempt.end_at,
        quoted_amount_cents: attempt.quoted_amount_cents,
        total_amount_cents: attempt.total_amount_cents ?? attempt.quoted_amount_cents,
        tax_amount_cents: attempt.tax_amount_cents ?? null,
        currency: attempt.currency,
        payment_intent_id: attempt.payment_intent_id
          ? `••••${String(attempt.payment_intent_id).slice(-6)}`
          : null,
        has_payment_intent: Boolean(attempt.payment_intent_id),
        confirmation_number: (attempt.supplier_confirmation_number || attempt.confirmation_number)
          ? `••••${String(attempt.supplier_confirmation_number || attempt.confirmation_number).slice(-4)}`
          : null,
        failure_reason: attempt.failure_reason,
        started_at: attempt.started_at,
        redirected_at: attempt.redirected_at,
        returned_at: attempt.returned_at,
        confirmed_at: attempt.confirmed_at,
        canceled_at: attempt.canceled_at,
        updated_at: attempt.updated_at,
        stale: isStaleMarketplaceAttempt(attempt, now),
        attendee_email: data.user?.email ?? null,
      };
    }),
  );
  const marketplaceWithEmail = q
    ? marketplaceWithEmailRaw.filter((row) => JSON.stringify(row).toLowerCase().includes(q))
    : marketplaceWithEmailRaw;

  const bookingTransactionsWithEmailRaw = await Promise.all(
    bookingTransactions.map(async (txn) => {
      const { data } = await db.auth.admin.getUserById(txn.user_id);
      return {
        ...txn,
        payment_intent_id: txn.payment_intent_id
          ? `••••${String(txn.payment_intent_id).slice(-6)}`
          : null,
        has_payment_intent: Boolean(txn.payment_intent_id),
        confirmation_number: txn.supplier_confirmation_number
          ? `••••${String(txn.supplier_confirmation_number).slice(-4)}`
          : null,
        attendee_email: data.user?.email ?? null,
      };
    }),
  );
  const bookingTransactionsWithEmail = q
    ? bookingTransactionsWithEmailRaw.filter((row) =>
        JSON.stringify(row).toLowerCase().includes(q),
      )
    : bookingTransactionsWithEmailRaw;

  const transactionEvents = await listRecentTransactionEvents(
    bookingTransactionsWithEmail.map((row) => row.id),
  );

  const queues = marketplaceExceptionQueues(marketplaceAttempts, now);
  const providerExceptions = {
    provider_not_configured: readiness.providers.filter((p) => !p.configured).map((p) => p.id),
    provider_unavailable: readiness.providers
      .filter((p) => p.configured && p.connection === "unavailable")
      .map((p) => p.id),
  };

  return NextResponse.json(
    {
      hotels: hotels.data ?? [],
      providers: readiness.providers.map((p) => ({
        id: p.id,
        name: p.name,
        configured: p.configured,
        connection: p.connection,
        kinds: p.kinds,
        lastCheckAt: p.lastCheckAt,
        lastCheckOk: p.lastCheckOk,
        lastFailureMessage: p.lastFailureMessage,
      })),
      marketplaceReadiness: {
        expediaConfigured: readiness.providers.find((p) => p.id === "expedia-rapid")?.configured ?? false,
        duffelConfigured: readiness.providers.find((p) => p.id === "duffel")?.configured ?? false,
        amadeusConfigured: readiness.providers.find((p) => p.id === "amadeus")?.configured ?? false,
        hotelsSearchOperational: readiness.hotels.searchOperational,
        flightsSearchOperational: readiness.flights.searchOperational,
        carsSearchOperational: readiness.cars.searchOperational,
        checkoutFulfillmentOperational: readiness.checkoutFulfillmentOperational,
      },
      analytics: { total: events.count ?? 0 },
      reservations,
      airports: airports.data ?? [],
      transport: transport.data ?? [],
      announcements: announcements.data ?? [],
      marketplaceAttempts: marketplaceWithEmail,
      bookingTransactions: bookingTransactionsWithEmail,
      transactionEvents,
      marketplaceQueues: queues,
      marketplaceProviderExceptions: providerExceptions,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const body = await request.json().catch(() => null);
  const db = getSupabaseAdmin();

  if (body?.kind === "availability") {
    const status = body.status === "AVAILABLE" ? "AVAILABLE" : "UNAVAILABLE";
    const { error } = await db
      .from("travel_hotel_nightly_availability")
      .update({
        availability_status: status,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("program_key", TRAVEL_PROGRAM_KEY);
    return error
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : NextResponse.json({ ok: true });
  }

  if (body?.kind === "airport") {
    const { data, error } = await db
      .from("travel_airports")
      .insert({
        program_key: TRAVEL_PROGRAM_KEY,
        iata_code: clean(body.iataCode, 8)?.toUpperCase(),
        name: clean(body.name, 160),
        guidance: clean(body.guidance, 4000),
        url: clean(body.url, 500),
        published: body.published === true,
        display_order: Number(body.displayOrder) || 0,
        created_by: auth.userId,
      })
      .select("id")
      .single();
    return error
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : NextResponse.json({ id: data.id }, { status: 201 });
  }

  if (body?.kind === "transport") {
    const kind = String(body.transportKind ?? "other");
    const allowed = [
      "airport_transfer",
      "official_shuttle",
      "hotel_shuttle",
      "rideshare",
      "public_transit",
      "parking",
      "charter_bus",
      "other",
    ];
    if (!allowed.includes(kind)) {
      return NextResponse.json({ error: "Invalid transportation kind." }, { status: 400 });
    }
    const { data, error } = await db
      .from("travel_transportation_options")
      .insert({
        program_key: TRAVEL_PROGRAM_KEY,
        kind,
        name: clean(body.name, 160),
        description: clean(body.description, 4000),
        url: clean(body.url, 500),
        published: body.published === true,
        display_order: Number(body.displayOrder) || 0,
        created_by: auth.userId,
      })
      .select("id")
      .single();
    return error
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : NextResponse.json({ id: data.id }, { status: 201 });
  }

  if (body?.kind === "announcement") {
    const { data, error } = await db
      .from("travel_announcements")
      .insert({
        program_key: TRAVEL_PROGRAM_KEY,
        title: clean(body.title, 200),
        body: clean(body.body, 4000),
        published: body.published === true,
        published_at: body.published === true ? new Date().toISOString() : null,
        created_by: auth.userId,
      })
      .select("id")
      .single();
    return error
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : NextResponse.json({ id: data.id }, { status: 201 });
  }

  if (body?.kind !== "hotel") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const payload = {
    program_key: TRAVEL_PROGRAM_KEY,
    name: clean(body.name, 160),
    address: clean(body.address, 300),
    city: clean(body.city, 100),
    state: clean(body.state, 80),
    postal_code: clean(body.postal_code, 20),
    published: body.published === true,
    created_by: auth.userId,
    updated_by: auth.userId,
  };
  const { data, error } = await db
    .from("travel_hotels")
    .insert(payload)
    .select("id")
    .single();
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ id: data.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const body = await request.json().catch(() => null);
  const db = getSupabaseAdmin();
  const id = clean(body?.id, 64);
  const action = String(body?.action ?? "");

  // owner_verify_retired: Owner verify/confirm is retired (verify, confirm, mark_verified).
  // Fail closed before DB access: manual verification never alters transaction state.
  const retiredAction = retiredOwnerActionDisposition("travel", action);
  if (retiredAction) {
    return NextResponse.json(
      { error: retiredAction.error, code: retiredAction.code },
      { status: 410 },
    );
  }

  if (body?.kind === "airport" || body?.kind === "transport" || body?.kind === "announcement") {
    if (!id) return NextResponse.json({ error: "Id required." }, { status: 400 });
    const table =
      body.kind === "airport"
        ? "travel_airports"
        : body.kind === "transport"
          ? "travel_transportation_options"
          : "travel_announcements";
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.published === "boolean") patch.published = body.published;
    if (typeof body.name === "string") patch.name = clean(body.name, 160);
    if (typeof body.title === "string") patch.title = clean(body.title, 200);
    if (typeof body.guidance === "string") patch.guidance = clean(body.guidance, 4000);
    if (typeof body.description === "string") patch.description = clean(body.description, 4000);
    if (typeof body.body === "string") patch.body = clean(body.body, 4000);
    if (typeof body.url === "string") patch.url = clean(body.url, 500);
    if (body.displayOrder !== undefined) patch.display_order = Number(body.displayOrder) || 0;
    if (body.kind === "announcement" && typeof body.published === "boolean" && body.published) {
      patch.published_at = new Date().toISOString();
    }
    const { data, error } = await db
      .from(table)
      .update(patch)
      .eq("id", id)
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .select("id")
      .maybeSingle();
    return error || !data
      ? NextResponse.json({ error: "Unable to update." }, { status: 400 })
      : NextResponse.json({ ok: true });
  }

  // Reservation mutations: cancel only (ledger / supplier sync live elsewhere).
  if (!id || action !== "cancel") {
    return NextResponse.json({ error: "Unsupported action. Allowed: cancel." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await db
    .from("travel_hotel_reservations")
    .select("id,confirmation_number,reservation_status")
    .eq("id", id)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  if (existingError || !existing) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  const changes: Record<string, unknown> = {
    reservation_status: "canceled",
    updated_at: new Date().toISOString(),
    primary_stay: false,
    canceled_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("travel_hotel_reservations")
    .update(changes)
    .eq("id", id)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }
  await db.from("travel_hotel_reservation_audit").insert({
    reservation_id: id,
    actor_user_id: auth.userId,
    action: "admin_cancel",
    details: {
      previous_status: existing.reservation_status,
      had_confirmation: Boolean(String(existing.confirmation_number || "").trim()),
    },
  });
  return NextResponse.json({ ok: true, status: "canceled" });
}
