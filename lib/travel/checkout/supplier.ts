import "server-only";
import { bookExpediaCar, bookExpediaHotel } from "@/lib/travel/marketplace/expedia-rapid";
import { createDuffelOrder, getDuffelOffer } from "@/lib/travel/marketplace/duffel";
import {
  duffelConfigured,
  expediaRapidConfigured,
} from "@/lib/travel/marketplace/credentials";

export type TravelCheckoutGuest = {
  givenName: string;
  familyName: string;
  email: string;
  phone?: string | null;
  bornOn?: string | null;
  gender?: "m" | "f" | null;
  title?: string | null;
};

export type SupplierBookResult = {
  confirmationNumber: string;
  raw: Record<string, unknown>;
  provider: string;
};

function requireGuest(guest: TravelCheckoutGuest) {
  const givenName = String(guest.givenName || "").trim();
  const familyName = String(guest.familyName || "").trim();
  const email = String(guest.email || "").trim().toLowerCase();
  if (givenName.length < 1 || familyName.length < 1) {
    throw new Error("Traveler given name and family name are required.");
  }
  if (!email.includes("@")) {
    throw new Error("A valid traveler email is required for supplier booking.");
  }
  return { givenName, familyName, email, phone: guest.phone || null };
}

export async function bookMarketplaceSupplier(input: {
  kind: "hotel" | "flight" | "car";
  provider: string;
  offerSnapshot: Record<string, unknown>;
  attemptId: string;
  totalAmountCents: number;
  currency: string;
  guest: TravelCheckoutGuest;
}): Promise<SupplierBookResult> {
  const guest = requireGuest(input.guest);
  const provider = String(input.provider || "").toLowerCase();
  const snap = input.offerSnapshot || {};

  if (input.kind === "hotel") {
    if (provider !== "expedia-rapid" && provider !== "expedia") {
      throw new Error(
        `Live hotel supplier booking requires Expedia Rapid. Provider "${provider}" is not supported for fulfillment.`,
      );
    }
    if (!expediaRapidConfigured()) {
      throw new Error("Expedia Rapid credentials are not configured.");
    }
    const propertyId = String(snap.propertyId || "").trim();
    const bookToken = String(snap.bookToken || "").trim();
    const checkIn = String(snap.checkIn || "").slice(0, 10);
    const checkOut = String(snap.checkOut || "").slice(0, 10);
    if (!propertyId || !bookToken) {
      throw new Error("Hotel offer is missing a live room package token.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      throw new Error("Hotel offer is missing valid check-in/check-out dates.");
    }
    const booked = await bookExpediaHotel({
      propertyId,
      bookToken,
      bedGroupId: snap.bedGroupId ? String(snap.bedGroupId) : null,
      checkIn,
      checkOut,
      affiliateReferenceId: input.attemptId.replace(/-/g, "").slice(0, 28),
      guest,
      adults: Number(snap.adults) > 0 ? Number(snap.adults) : 2,
    });
    return {
      confirmationNumber: booked.confirmationNumber,
      raw: booked.raw,
      provider: "expedia-rapid",
    };
  }

  if (input.kind === "car") {
    if (provider !== "expedia-rapid" && provider !== "expedia") {
      throw new Error(
        `Live rental-car supplier booking requires Expedia Rapid. Provider "${provider}" is not supported for fulfillment.`,
      );
    }
    if (!expediaRapidConfigured()) {
      throw new Error("Expedia Rapid credentials are not configured.");
    }
    const bookToken = String(snap.bookToken || snap.id || "").trim();
    const pickupAt = String(snap.pickupAt || "").trim();
    const dropoffAt = String(snap.dropoffAt || "").trim();
    if (!bookToken) throw new Error("Car offer is missing a live book token.");
    if (!pickupAt || !dropoffAt) throw new Error("Car offer is missing pickup/dropoff times.");
    const booked = await bookExpediaCar({
      bookToken,
      affiliateReferenceId: input.attemptId.replace(/-/g, "").slice(0, 28),
      guest,
      pickupAt,
      dropoffAt,
    });
    return {
      confirmationNumber: booked.confirmationNumber,
      raw: booked.raw,
      provider: "expedia-rapid",
    };
  }

  if (provider !== "duffel") {
    throw new Error(
      `Live flight supplier booking requires Duffel. Provider "${provider}" is not supported for fulfillment.`,
    );
  }
  if (!duffelConfigured()) {
    throw new Error("Duffel credentials are not configured.");
  }

  const offerId = String(snap.bookToken || snap.id || "").trim();
  if (!offerId) throw new Error("Flight offer is missing a live Duffel offer id.");

  const liveOffer = await getDuffelOffer(offerId);
  if (liveOffer.totalFareCents !== input.totalAmountCents) {
    // Allow tax/service fee on Stripe side to exceed supplier fare; supplier amount must match offer fare snapshot.
    const fareOnly = Number(snap.fareCents || snap.totalFareCents || 0);
    if (fareOnly > 0 && liveOffer.totalFareCents !== fareOnly) {
      throw new Error("Duffel offer price changed. Re-search and start checkout again.");
    }
  }

  const passengerId = liveOffer.passengerIds[0];
  if (!passengerId) throw new Error("Duffel offer is missing passenger slots.");
  const bornOn = String(input.guest.bornOn || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bornOn)) {
    throw new Error("Flight booking requires traveler date of birth (YYYY-MM-DD).");
  }
  const gender = input.guest.gender === "f" ? "f" : "m";
  const phoneNumber = String(guest.phone || "+17138242079");
  const amountMajor = (liveOffer.totalFareCents / 100).toFixed(2);

  const order = await createDuffelOrder({
    offerId: liveOffer.id,
    amount: amountMajor,
    currency: liveOffer.currency,
    passengers: [
      {
        id: passengerId,
        title: input.guest.title || "mr",
        givenName: guest.givenName,
        familyName: guest.familyName,
        bornOn,
        gender,
        email: guest.email,
        phoneNumber: phoneNumber.startsWith("+") ? phoneNumber : `+1${phoneNumber.replace(/\D/g, "")}`,
      },
    ],
  });

  return {
    confirmationNumber: order.confirmationNumber,
    raw: order.raw,
    provider: "duffel",
  };
}
