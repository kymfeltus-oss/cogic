/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { providerStatuses } from "@/lib/travel/providers";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";

const clean = (v: unknown, n = 1000) => String(v ?? "").trim().slice(0, n) || null;

export async function GET(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const db = getSupabaseAdmin();
  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() || "";

  const [hotels, events, res, airports, transport, announcements] = await Promise.all([
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

  return NextResponse.json(
    {
      hotels: hotels.data ?? [],
      providers: providerStatuses(),
      analytics: { total: events.count ?? 0 },
      reservations,
      airports: airports.data ?? [],
      transport: transport.data ?? [],
      announcements: announcements.data ?? [],
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

  if (!id || !["verify","cancel"].includes(action)) {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const status = action === "verify" ? "confirmed" : "canceled";
  const changes: any = {
    reservation_status: status,
    updated_at: new Date().toISOString(),
  };
  if (action === "verify") {
    changes.verified_by = auth.userId;
    changes.confirmed_at = new Date().toISOString();
  } else {
    changes.primary_stay = false;
    changes.canceled_at = new Date().toISOString();
  }

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
    action: `admin_${action}`,
    details: {},
  });
  return NextResponse.json({ ok: true, status });
}
