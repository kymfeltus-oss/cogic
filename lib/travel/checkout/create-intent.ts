import "server-only";
import { getUserFromSession } from "@/lib/auth/session";
import { travelServiceFeeCents } from "@/lib/travel/checkout/constants";
import {
  insertDraftCheckoutAttempt,
  markAttemptPaymentPending,
  upsertCheckoutLedger,
} from "@/lib/travel/checkout/repository";
import {
  applyCorporateTaxExemptionToTotals,
  buildTaxExemptionSnapshotFields,
  resolveCorporateTaxExemptionForCheckout,
} from "@/lib/travel/corporate/resolve-tax-exemption";
import { clientClaimsChurchTaxExemptTravel } from "@/lib/travel/corporate/tax-exemption-checkout";
import { createTravelPaymentIntent } from "@/lib/travel/checkout/stripe";
import {
  duffelConfigured,
  expediaRapidConfigured,
  marketplaceCarProvider,
  marketplaceFlightProvider,
  marketplaceHotelProvider,
  marketplaceUnavailableReason,
  travelDemoModeEnabled,
} from "@/lib/travel/marketplace/credentials";
import { getDuffelOffer } from "@/lib/travel/marketplace/duffel";
import {
  assertExactBookTokenMatch,
  selectAuthoritativeFareCents,
} from "@/lib/travel/checkout/client-authority";
import {
  priceCheckExpediaCar,
  priceCheckExpediaHotel,
} from "@/lib/travel/marketplace/expedia-rapid";

export type CreateTravelIntentInput = {
  userId: string;
  email: string;
  kind: "hotel" | "flight" | "car";
  offerId: string;
  bookToken?: string | null;
  provider?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  pickupAt?: string | null;
  dropoffAt?: string | null;
  adults?: number | null;
  offer?: Record<string, unknown> | null;
  /** Client claim only — never trusted as verification. */
  churchTaxExemptClaim?: boolean;
  guest?: {
    givenName?: string;
    familyName?: string;
    phone?: string | null;
    bornOn?: string | null;
    gender?: "m" | "f" | null;
    title?: string | null;
  } | null;
};

type PricedCheckout = {
  provider: string;
  offerId: string;
  bookToken: string;
  fareCents: number;
  taxAmountCents: number;
  serviceFeeCents: number;
  totalAmountCents: number;
  currency: string;
  snapshot: Record<string, unknown>;
  destinationLabel: string;
  originLabel: string | null;
  startAt: string | null;
  endAt: string | null;
};

function textField(value: unknown, max = 240) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, max);
}

function guestSnapshot(
  guest: CreateTravelIntentInput["guest"],
): Record<string, unknown> | null {
  if (!guest || typeof guest !== "object") return null;
  return {
    givenName: textField(guest.givenName, 80),
    familyName: textField(guest.familyName, 80),
    phone: textField(guest.phone, 40),
    bornOn: textField(guest.bornOn, 10),
    gender: guest.gender === "f" || guest.gender === "m" ? guest.gender : null,
    title: textField(guest.title, 40),
  };
}

/**
 * Gate live booking kinds on verified server env credentials.
 * Hotels/cars → Expedia Rapid. Flights → Duffel.
 * Amadeus search alone is not a fulfillment path for in-app capture.
 */
function requireProviderForKind(kind: "hotel" | "flight" | "car") {
  if (kind === "hotel") {
    const provider = marketplaceHotelProvider();
    if (!provider) throw new Error(marketplaceUnavailableReason("hotels"));
    if (provider !== "expedia-rapid") {
      throw new Error(
        "Live hotel checkout requires Expedia Rapid credentials. Configure EXPEDIA_RAPID_API_KEY and EXPEDIA_RAPID_API_SECRET.",
      );
    }
    if (!expediaRapidConfigured()) throw new Error(marketplaceUnavailableReason("hotels"));
    return provider;
  }
  if (kind === "car") {
    const provider = marketplaceCarProvider();
    if (!provider) throw new Error(marketplaceUnavailableReason("cars"));
    if (provider !== "expedia-rapid") {
      throw new Error(
        "Live rental-car checkout requires Expedia Rapid credentials. Configure EXPEDIA_RAPID_API_KEY and EXPEDIA_RAPID_API_SECRET.",
      );
    }
    if (!expediaRapidConfigured()) throw new Error(marketplaceUnavailableReason("cars"));
    return provider;
  }
  const provider = marketplaceFlightProvider();
  if (!provider) throw new Error(marketplaceUnavailableReason("flights"));
  if (provider !== "duffel") {
    throw new Error(
      "Live flight checkout requires Duffel credentials. Configure DUFFEL_ACCESS_TOKEN.",
    );
  }
  if (!duffelConfigured()) throw new Error(marketplaceUnavailableReason("flights"));
  return provider;
}

/**
 * Build an allowlisted offer snapshot. Never spread the client offer object —
 * money fields come only from live provider retrieve / price-check.
 */
function buildTrustedSnapshot(input: {
  kind: "hotel" | "flight" | "car";
  provider: string;
  offerId: string;
  bookToken: string;
  fareCents: number;
  taxAmountCents: number;
  serviceFeeCents: number;
  totalAmountCents: number;
  currency: string;
  pricedBy: string;
  propertyId?: string | null;
  bedGroupId?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  pickupAt?: string | null;
  dropoffAt?: string | null;
  adults?: number | null;
  name?: string | null;
  city?: string | null;
  state?: string | null;
  roomName?: string | null;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  origin?: string | null;
  destination?: string | null;
  departAt?: string | null;
  arriveAt?: string | null;
  cabin?: string | null;
  guest?: CreateTravelIntentInput["guest"];
}): Record<string, unknown> {
  return {
    id: input.offerId,
    bookToken: input.bookToken,
    provider: input.provider,
    kind: input.kind,
    propertyId: input.propertyId ?? null,
    bedGroupId: input.bedGroupId ?? null,
    checkIn: input.checkIn ?? null,
    checkOut: input.checkOut ?? null,
    pickupAt: input.pickupAt ?? null,
    dropoffAt: input.dropoffAt ?? null,
    adults: input.adults && input.adults > 0 ? input.adults : null,
    name: input.name ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    roomName: input.roomName ?? null,
    pickupLocation: input.pickupLocation ?? null,
    dropoffLocation: input.dropoffLocation ?? null,
    origin: input.origin ?? null,
    destination: input.destination ?? null,
    departAt: input.departAt ?? null,
    arriveAt: input.arriveAt ?? null,
    cabin: input.cabin ?? null,
    totalRateCents: input.fareCents,
    totalFareCents: input.fareCents,
    fareCents: input.fareCents,
    taxAmountCents: input.taxAmountCents,
    serviceFeeCents: input.serviceFeeCents,
    totalAmountCents: input.totalAmountCents,
    quoted_amount_cents: input.totalAmountCents,
    currency: input.currency,
    guest: guestSnapshot(input.guest),
    pricedAt: new Date().toISOString(),
    pricedBy: input.pricedBy,
  };
}

async function resolveLivePricing(
  input: CreateTravelIntentInput,
  provider: string,
): Promise<PricedCheckout> {
  const offer =
    input.offer && typeof input.offer === "object" ? input.offer : ({} as Record<string, unknown>);
  // Identity / logistics tokens only — never read money from the client offer.
  // Hotels/cars require an explicit bookToken (never invent one from a composite offerId).
  const requestedBookToken = String(input.bookToken || offer.bookToken || "").trim();
  const offerId = String(input.offerId || "").trim();

  if (input.kind === "flight") {
    const duffelOfferId = String(requestedBookToken || offerId).trim();
    if (!duffelOfferId) {
      throw new Error("A live Duffel offer_id is required.");
    }
    const live = await getDuffelOffer(duffelOfferId);
    const fareCents = selectAuthoritativeFareCents(live.totalFareCents, offer);
    if (!Number.isFinite(fareCents) || fareCents <= 0) {
      throw new Error("Duffel offer retrieve returned no live fare.");
    }
    const taxAmountCents = live.taxAmountCents ?? 0;
    const serviceFeeCents = travelServiceFeeCents(fareCents);
    const totalAmountCents = fareCents + serviceFeeCents;
    const currency = String(live.currency || "USD").toUpperCase();
    const origin = textField(offer.origin || offer.origin_label, 8);
    const destination = textField(offer.destination || offer.destination_label, 8);
    const departAt = textField(offer.departAt, 40);
    const arriveAt = textField(offer.arriveAt, 40);
    return {
      provider,
      offerId: live.id,
      bookToken: live.id,
      fareCents,
      taxAmountCents,
      serviceFeeCents,
      totalAmountCents,
      currency,
      snapshot: buildTrustedSnapshot({
        kind: "flight",
        provider: "duffel",
        offerId: live.id,
        bookToken: live.id,
        fareCents,
        taxAmountCents,
        serviceFeeCents,
        totalAmountCents,
        currency,
        pricedBy: "duffel_offer_retrieve",
        origin,
        destination,
        departAt,
        arriveAt,
        cabin: textField(offer.cabin, 40),
        guest: input.guest,
      }),
      destinationLabel: destination || "Flight",
      originLabel: origin,
      startAt: departAt,
      endAt: arriveAt,
    };
  }

  const propertyId = textField(offer.propertyId, 80);
  const checkIn = String(input.checkIn || offer.checkIn || "").slice(0, 10) || null;
  const checkOut = String(input.checkOut || offer.checkOut || "").slice(0, 10) || null;
  const pickupAt = String(input.pickupAt || offer.pickupAt || "") || null;
  const dropoffAt = String(input.dropoffAt || offer.dropoffAt || "") || null;
  const adults = input.adults && input.adults > 0 ? input.adults : 2;
  const hintBedGroupId = textField(offer.bedGroupId, 80);

  if (input.kind === "hotel") {
    if (!propertyId) throw new Error("Hotel offer is missing propertyId from the live search.");
    if (!requestedBookToken) {
      throw new Error("Hotel offer is missing a room package bookToken.");
    }
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      throw new Error("Hotel checkout requires valid checkIn and checkOut dates.");
    }
    const live = await priceCheckExpediaHotel({
      propertyId,
      bookToken: requestedBookToken,
      bedGroupId: hintBedGroupId,
      checkIn,
      checkOut,
      adults,
    });
    // Demo interceptor returns a static sandbox bookToken; accept it only when travelDemoModeEnabled.
    const bookToken = travelDemoModeEnabled()
      ? String(live.bookToken || "").trim()
      : assertExactBookTokenMatch(requestedBookToken, live.bookToken, "hotel");
    if (!bookToken) {
      throw new Error("Expedia hotel price check returned no bookToken.");
    }
    if (!Number.isFinite(live.totalRateCents) || live.totalRateCents <= 0) {
      throw new Error("Expedia hotel price check returned no live total.");
    }
    const fareCents = selectAuthoritativeFareCents(live.totalRateCents, offer);
    const taxAmountCents = live.taxAmountCents;
    const serviceFeeCents = travelServiceFeeCents(fareCents);
    const totalAmountCents = fareCents + serviceFeeCents;
    const currency = String(live.currency || "USD").toUpperCase();
    const name = textField(offer.name, 160);
    const city = textField(offer.city, 80);
    const state = textField(offer.state, 40);
    const resolvedOfferId = offerId || bookToken;
    return {
      provider,
      offerId: resolvedOfferId,
      bookToken,
      fareCents,
      taxAmountCents,
      serviceFeeCents,
      totalAmountCents,
      currency,
      snapshot: buildTrustedSnapshot({
        kind: "hotel",
        provider,
        offerId: resolvedOfferId,
        bookToken,
        fareCents,
        taxAmountCents,
        serviceFeeCents,
        totalAmountCents,
        currency,
        pricedBy: "expedia_hotel_price_check",
        propertyId: live.propertyId || propertyId,
        bedGroupId: live.bedGroupId,
        checkIn,
        checkOut,
        adults,
        name,
        city,
        state,
        roomName: textField(offer.roomName, 120),
        guest: input.guest,
      }),
      destinationLabel: [name, city, state].filter(Boolean).join(" · ") || name || "Hotel",
      originLabel: null,
      startAt: `${checkIn}T15:00:00.000Z`,
      endAt: `${checkOut}T11:00:00.000Z`,
    };
  }

  if (!requestedBookToken) throw new Error("Car offer is missing a live bookToken.");
  if (!pickupAt || !dropoffAt || dropoffAt <= pickupAt) {
    throw new Error("Car checkout requires valid pickupAt and dropoffAt datetimes.");
  }
  const pickupLocation = textField(offer.pickupLocation, 120) || "STL";
  const dropoffLocation = textField(offer.dropoffLocation, 120) || pickupLocation;
  const live = await priceCheckExpediaCar({
    bookToken: requestedBookToken,
    pickupLocation,
    dropoffLocation,
    pickupAt,
    dropoffAt,
  });
  // Demo interceptor returns a static sandbox bookToken; accept it only when travelDemoModeEnabled.
  const bookToken = travelDemoModeEnabled()
    ? String(live.bookToken || "").trim()
    : assertExactBookTokenMatch(requestedBookToken, live.bookToken, "car");
  if (!bookToken) {
    throw new Error("Expedia car price check returned no bookToken.");
  }
  if (!Number.isFinite(live.totalRateCents) || live.totalRateCents <= 0) {
    throw new Error("Expedia car price check returned no live total.");
  }
  const fareCents = selectAuthoritativeFareCents(live.totalRateCents, offer);
  const taxAmountCents = live.taxAmountCents;
  const serviceFeeCents = travelServiceFeeCents(fareCents);
  const totalAmountCents = fareCents + serviceFeeCents;
  const currency = String(live.currency || "USD").toUpperCase();
  const resolvedOfferId = offerId || bookToken;
  return {
    provider,
    offerId: resolvedOfferId,
    bookToken,
    fareCents,
    taxAmountCents,
    serviceFeeCents,
    totalAmountCents,
    currency,
    snapshot: buildTrustedSnapshot({
      kind: "car",
      provider,
      offerId: resolvedOfferId,
      bookToken,
      fareCents,
      taxAmountCents,
      serviceFeeCents,
      totalAmountCents,
      currency,
      pricedBy: "expedia_car_price_check",
      pickupAt,
      dropoffAt,
      pickupLocation,
      dropoffLocation,
      name: textField(offer.vehicleName || offer.name, 160),
      guest: input.guest,
    }),
    destinationLabel: dropoffLocation || pickupLocation || "Rental car",
    originLabel: pickupLocation,
    startAt: pickupAt,
    endAt: dropoffAt,
  };
}

/**
 * Bridge live provider offers → DRAFT ledger → Stripe PaymentIntent → PAYMENT_PENDING.
 * Amounts are computed server-side in cents from live provider price-check / retrieve.
 * Client-provided totals are never used for Stripe charge amounts.
 *
 * Corporate tax-exempt claims ("Church Tax-Exempt Business Travel") only reduce municipal
 * tax when church_tax_profiles.verification_status is server-verified for the session
 * user's church. Session identity comes from getUserFromSession() — never body userId.
 */
export async function createTravelCheckoutIntent(input: CreateTravelIntentInput) {
  const kind = input.kind;
  if (kind !== "hotel" && kind !== "flight" && kind !== "car") {
    throw new Error("kind must be hotel, flight, or car.");
  }

  const sessionUser = await getUserFromSession();
  const sessionUserId = sessionUser?.id?.trim() ?? "";
  if (!sessionUserId) {
    throw new Error("Authentication required for travel checkout.");
  }
  if (sessionUserId !== input.userId) {
    throw new Error("Checkout session identity does not match authenticated buyer.");
  }

  const provider = requireProviderForKind(kind);
  const priced = await resolveLivePricing(input, provider);

  // Claim detection only — never trusts client verification_status / tax_profile_id / amounts.
  const clientClaimed =
    Boolean(input.churchTaxExemptClaim) ||
    clientClaimsChurchTaxExemptTravel(null, input.offer ?? null);

  const exemption = await resolveCorporateTaxExemptionForCheckout({
    userId: sessionUserId,
    clientClaimed,
    municipalTaxCents: priced.taxAmountCents,
  });

  const totals = applyCorporateTaxExemptionToTotals({
    fareCents: priced.fareCents,
    serviceFeeCents: priced.serviceFeeCents,
    municipalTaxCents: priced.taxAmountCents,
    decision: exemption,
  });

  const offerSnapshot: Record<string, unknown> = {
    ...priced.snapshot,
    ...buildTaxExemptionSnapshotFields(exemption),
    fareCents: totals.fareCents,
    taxAmountCents: totals.taxAmountCents,
    serviceFeeCents: totals.serviceFeeCents,
    totalAmountCents: totals.totalAmountCents,
    quoted_amount_cents: totals.totalAmountCents,
    checkout_type: "travel_marketplace",
  };

  if (!Number.isInteger(totals.totalAmountCents) || totals.totalAmountCents < 50) {
    throw new Error("Live provider total must be at least $0.50 before checkout.");
  }

  const attempt = await insertDraftCheckoutAttempt({
    userId: sessionUserId,
    kind,
    provider: priced.provider,
    offerId: priced.offerId,
    offerSnapshot,
    totalAmountCents: totals.totalAmountCents,
    taxAmountCents: totals.taxAmountCents,
    currency: priced.currency,
    destinationLabel: priced.destinationLabel,
    originLabel: priced.originLabel,
    startAt: priced.startAt,
    endAt: priced.endAt,
  });

  const verifiedTaxProfileId = exemption.applied ? exemption.taxProfileId : null;

  const transactionId = await upsertCheckoutLedger({
    attempt,
    status: "DRAFT",
    taxProfileId: verifiedTaxProfileId,
  });

  const paymentIntent = await createTravelPaymentIntent({
    amountCents: totals.totalAmountCents,
    currency: priced.currency,
    customerEmail: input.email,
    userId: sessionUserId,
    attemptId: attempt.id,
    transactionId,
    kind,
    provider: priced.provider,
    description: `COGIC Travel ${kind} — ${priced.destinationLabel}`,
    taxProfileId: verifiedTaxProfileId,
    taxExemptionApplied: exemption.applied,
  });

  const pending = await markAttemptPaymentPending({
    attemptId: attempt.id,
    userId: sessionUserId,
    paymentIntentId: paymentIntent.id,
    transactionId,
  });

  if (!paymentIntent.client_secret) {
    throw new Error("Stripe PaymentIntent was created without a client_secret.");
  }

  return {
    attemptId: pending.id,
    transactionId,
    status: pending.status,
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    amountCents: totals.totalAmountCents,
    fareCents: totals.fareCents,
    taxAmountCents: totals.taxAmountCents,
    serviceFeeCents: totals.serviceFeeCents,
    currency: priced.currency,
    provider: priced.provider,
    kind,
    offerId: priced.offerId,
    taxExemptionApplied: exemption.applied,
    taxProfileId: verifiedTaxProfileId,
  };
}
