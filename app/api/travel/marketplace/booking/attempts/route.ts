import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import {
  cancelMarketplaceAttempt,
  listUserMarketplaceAttempts,
  type MarketplaceAttemptStatus,
} from "@/lib/travel/marketplace/booking";

export async function GET(request: Request) {
  const user = await getUserFromSession();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const statusParam = new URL(request.url).searchParams.get("status");
  const statuses = statusParam
    ? (statusParam.split(",").filter(Boolean) as MarketplaceAttemptStatus[])
    : (["DRAFT", "PAYMENT_PENDING", "SUPPLIER_SUBMITTED"] as MarketplaceAttemptStatus[]);

  try {
    const attempts = await listUserMarketplaceAttempts(user.id, statuses);
    return NextResponse.json(
      { attempts },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load booking attempts." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getUserFromSession();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const attemptId = String(body?.attemptId || "");
  const action = String(body?.action || "");
  if (!attemptId || action !== "cancel") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }
  try {
    const attempt = await cancelMarketplaceAttempt({
      userId: user.id,
      attemptId,
      reason: body?.reason ? String(body.reason) : "Canceled by attendee",
    });
    if (!attempt) return NextResponse.json({ error: "Booking attempt not found." }, { status: 404 });
    return NextResponse.json({ attemptId: attempt.id, status: attempt.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to cancel booking attempt." },
      { status: 400 },
    );
  }
}
