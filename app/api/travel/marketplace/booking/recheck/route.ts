import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import { recheckMarketplaceAttempt } from "@/lib/travel/marketplace/booking";

export async function POST(request: Request) {
  const user = await getUserFromSession();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const attemptId = String(body?.attemptId || "");
  if (!attemptId) {
    return NextResponse.json({ error: "Booking attempt is required." }, { status: 400 });
  }

  // Never accept client-supplied status/userId/confirmation.
  if (body?.status || body?.userId || body?.confirmationNumber) {
    return NextResponse.json(
      { error: "Client cannot force booking confirmation status." },
      { status: 400 },
    );
  }

  try {
    const result = await recheckMarketplaceAttempt({
      userId: user.id,
      attemptId,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to recheck booking." },
      { status: 400 },
    );
  }
}
