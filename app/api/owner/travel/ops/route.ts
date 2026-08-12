import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { syncMarketplaceAttemptSupplierStatus } from "@/lib/travel/ops/supplier-sync";
import { ownerRefundMarketplaceAttempt } from "@/lib/travel/ops/manual-refund";
import { upsertInventoryDateRange } from "@/lib/travel/ops/inventory-dates";
import { logOwnerTransactionOverride } from "@/lib/travel/ops/ledger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const body = await request.json().catch(() => null);
  const action = String(body?.action || "");

  // Manual confirmation bypasses are gone. log_override is audit annotation only (status unchanged).
  if (
    action === "verify" ||
    action === "confirm" ||
    action === "approve" ||
    action === "mark_verified" ||
    action === "manual_confirm"
  ) {
    return NextResponse.json(
      {
        error:
          "Owner verify/confirm is retired. Use sync_supplier_status after a paid booking, or refund_stripe for legitimate reversals.",
        code: "owner_verify_retired",
      },
      { status: 410 },
    );
  }

  try {
    if (action === "sync_supplier_status") {
      const attemptId = String(body?.attemptId || "").trim();
      if (!attemptId) {
        return NextResponse.json({ error: "attemptId is required." }, { status: 400 });
      }
      const db = getSupabaseAdmin();
      const { data: attempt } = await db
        .from("travel_marketplace_booking_attempts")
        .select("user_id")
        .eq("id", attemptId)
        .maybeSingle();
      let attendeeEmail: string | null = null;
      if (attempt?.user_id) {
        const user = await db.auth.admin.getUserById(attempt.user_id);
        attendeeEmail = user.data.user?.email ?? null;
      }
      const result = await syncMarketplaceAttemptSupplierStatus({
        attemptId,
        actorUserId: auth.userId,
        attendeeEmail,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "refund_stripe") {
      const attemptId = String(body?.attemptId || "").trim();
      const reason = String(body?.reason || "").trim();
      if (!attemptId) {
        return NextResponse.json({ error: "attemptId is required." }, { status: 400 });
      }
      const result = await ownerRefundMarketplaceAttempt({
        attemptId,
        actorUserId: auth.userId,
        reason,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "inventory_dates") {
      const roomTypeId = String(body?.roomTypeId || "").trim();
      const fromDate = String(body?.fromDate || "").trim();
      const toDate = String(body?.toDate || "").trim();
      const status = body?.status === "AVAILABLE" ? "AVAILABLE" : "UNAVAILABLE";
      const nightlyRateCents =
        body?.nightlyRateCents == null || body?.nightlyRateCents === ""
          ? null
          : Number(body.nightlyRateCents);
      if (!roomTypeId) {
        return NextResponse.json({ error: "roomTypeId is required." }, { status: 400 });
      }
      const result = await upsertInventoryDateRange({
        roomTypeId,
        fromDate,
        toDate,
        status,
        nightlyRateCents: Number.isFinite(nightlyRateCents as number)
          ? Math.round(Number(nightlyRateCents))
          : null,
        actorUserId: auth.userId,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "log_override") {
      const result = await logOwnerTransactionOverride({
        actorUserId: auth.userId,
        attemptId: body?.attemptId ? String(body.attemptId) : null,
        transactionId: body?.transactionId ? String(body.transactionId) : null,
        note: String(body?.note || ""),
        eventName: body?.eventName ? String(body.eventName) : "owner_internal_override",
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Unsupported ops action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Travel ops action failed." },
      { status: 400 },
    );
  }
}
