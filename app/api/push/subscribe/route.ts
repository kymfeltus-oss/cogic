import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import { isWebPushConfigured } from "@/lib/push/vapid";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  userAgent?: string;
  reason?: string;
};

export async function POST(request: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web Push is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh.trim() : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth.trim() : "";
  const userAgent =
    typeof body?.userAgent === "string" ? body.userAgent.trim().slice(0, 300) : null;

  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Valid endpoint and encryption keys are required." },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Reassign endpoint ownership if another user previously owned this browser subscription.
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      channel: "web_push",
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
      enabled: true,
      revoked_at: null,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: "Unable to save subscription." }, { status: 500 });
  }

  // Ensure preference row exists with defaults.
  await admin.from("notification_preferences").upsert(
    { user_id: user.id, updated_at: now },
    { onConflict: "user_id" },
  );

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function DELETE(request: Request) {
  const user = await getUserFromSession();
  const body = (await request.json().catch(() => null)) as Body | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  // On logout, revoke even if session is already ending — match by endpoint.
  // Prefer authenticated owner; if no session, still revoke by endpoint for shared-device safety
  // when reason is logout (caller had session when starting logout).
  if (user) {
    const { error } = await admin
      .from("push_subscriptions")
      .update({
        enabled: false,
        revoked_at: now,
        updated_at: now,
      })
      .eq("endpoint", endpoint)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: "Unable to revoke subscription." }, { status: 500 });
    }
  } else if (body?.reason === "logout") {
    await admin
      .from("push_subscriptions")
      .update({
        enabled: false,
        revoked_at: now,
        updated_at: now,
      })
      .eq("endpoint", endpoint);
  } else {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
