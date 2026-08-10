import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import { createMarketplaceBookingAttempt } from "@/lib/travel/marketplace/booking";
import type { MarketplaceCarOffer, MarketplaceFlightOffer, MarketplaceHotelOffer } from "@/lib/travel/marketplace/types";

export async function POST(request: Request) {
  const user = await getUserFromSession();
  if (!user?.id) {
    return NextResponse.json(
      {
        error: "Sign in required.",
        loginUrl: `/login?next=${encodeURIComponent("/travel")}`,
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const kind = String(body?.kind || "") as "hotel" | "flight" | "car";
  if (!["hotel", "flight", "car"].includes(kind)) {
    return NextResponse.json({ error: "Invalid travel type." }, { status: 400 });
  }
  const offer = body?.offer;
  if (!offer || typeof offer !== "object" || !offer.id) {
    return NextResponse.json({ error: "A marketplace offer is required." }, { status: 400 });
  }
  const provider = String(offer.provider || body?.provider || "").trim();
  if (!provider) {
    return NextResponse.json({ error: "Offer provider is required." }, { status: 400 });
  }

  try {
    const started = await createMarketplaceBookingAttempt({
      userId: user.id,
      kind,
      provider,
      offer: offer as MarketplaceHotelOffer | MarketplaceFlightOffer | MarketplaceCarOffer,
      checkIn: body?.checkIn ? String(body.checkIn) : null,
      checkOut: body?.checkOut ? String(body.checkOut) : null,
    });

    return NextResponse.json(
      {
        attemptId: started.attempt.id,
        status: started.attempt.status,
        openPartner: started.openPartner,
        partnerUrl: started.attempt.partner_booking_url,
        returnUrl: started.returnUrl,
        redirectTo: started.redirectTo,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start booking." },
      { status: 400 },
    );
  }
}
