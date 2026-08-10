import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import {
  markMarketplaceAttemptRedirected,
  markMarketplaceAttemptReturned,
} from "@/lib/travel/marketplace/booking";

export async function POST(request: Request) {
  const user = await getUserFromSession();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const attemptId = String(body?.attemptId || "");
  const action = String(body?.action || "return");
  if (!attemptId) {
    return NextResponse.json({ error: "Booking attempt is required." }, { status: 400 });
  }
  if (body?.status || body?.userId || body?.confirmationNumber || body?.confirmed === true) {
    return NextResponse.json(
      { error: "Partner redirect cannot force booking confirmation." },
      { status: 400 },
    );
  }

  try {
    if (action === "redirected") {
      const attempt = await markMarketplaceAttemptRedirected(attemptId, user.id);
      if (!attempt) return NextResponse.json({ error: "Booking attempt not found." }, { status: 404 });
      return NextResponse.json({ attemptId: attempt.id, status: attempt.status });
    }

    const attempt = await markMarketplaceAttemptReturned(attemptId, user.id);
    if (!attempt) return NextResponse.json({ error: "Booking attempt not found." }, { status: 404 });

    // Redirect alone never confirms. Provider lookup is not available without booking APIs/credentials.
    return NextResponse.json({
      attemptId: attempt.id,
      status: attempt.status,
      confirmed: attempt.status === "confirmed",
      pendingConfirmation: attempt.status === "pending_confirmation",
      redirectTo: "/travel/trip?marketplace=pending",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reconcile booking return." },
      { status: 400 },
    );
  }
}
