import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import { confirmMarketplaceAttempt } from "@/lib/travel/marketplace/booking";

export async function POST(request: Request) {
  const user = await getUserFromSession();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const attemptId = String(body?.attemptId || "");
  const confirmationNumber = String(body?.confirmationNumber || "");
  if (!attemptId) {
    return NextResponse.json({ error: "Booking attempt is required." }, { status: 400 });
  }
  if (body?.status || body?.userId) {
    return NextResponse.json(
      { error: "Client cannot force booking confirmation status." },
      { status: 400 },
    );
  }

  try {
    const attempt = await confirmMarketplaceAttempt({
      userId: user.id,
      attemptId,
      confirmationNumber,
      notes: body?.notes ? String(body.notes) : null,
    });
    return NextResponse.json({
      attemptId: attempt.id,
      status: attempt.status,
      confirmed: true,
      redirectTo: "/travel/trip?marketplace=confirmed",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to confirm booking." },
      { status: 400 },
    );
  }
}
