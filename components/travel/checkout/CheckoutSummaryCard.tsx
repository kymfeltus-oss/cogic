"use client";

import { formatTravelMoney } from "@/lib/travel/checkout/offer-session";

type Props = {
  kind: "hotel" | "flight" | "car";
  offer: Record<string, unknown>;
  checkIn?: string | null;
  checkOut?: string | null;
  pickupAt?: string | null;
  dropoffAt?: string | null;
  fareCents: number;
  taxAmountCents: number;
  serviceFeeCents: number;
  totalAmountCents: number;
  currency: string;
};

function text(value: unknown, fallback = "—") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

export default function CheckoutSummaryCard({
  kind,
  offer,
  checkIn,
  checkOut,
  pickupAt,
  dropoffAt,
  fareCents,
  taxAmountCents,
  serviceFeeCents,
  totalAmountCents,
  currency,
}: Props) {
  const title =
    kind === "hotel"
      ? text(offer.name, "Hotel stay")
      : kind === "flight"
        ? `${text(offer.origin)} → ${text(offer.destination)}`
        : text(offer.vehicleName || offer.company, "Rental car");

  return (
    <section className="tc-card" aria-labelledby="tc-summary-heading">
      <h2 id="tc-summary-heading">Trip summary</h2>
      <p style={{ margin: "0 0 0.85rem", fontWeight: 800 }}>{title}</p>
      <dl className="tc-rows">
        {kind === "hotel" ? (
          <>
            <div className="tc-row">
              <dt>Room</dt>
              <dd>{text(offer.roomName, "Selected rate")}</dd>
            </div>
            <div className="tc-row">
              <dt>Check-in</dt>
              <dd>{text(checkIn || offer.checkIn)}</dd>
            </div>
            <div className="tc-row">
              <dt>Check-out</dt>
              <dd>{text(checkOut || offer.checkOut)}</dd>
            </div>
            <div className="tc-row">
              <dt>Property</dt>
              <dd>{[offer.city, offer.state].filter(Boolean).join(", ") || text(offer.address)}</dd>
            </div>
          </>
        ) : null}
        {kind === "flight" ? (
          <>
            <div className="tc-row">
              <dt>Flight</dt>
              <dd>{text(offer.flightNumber || offer.airline, "Selected flight")}</dd>
            </div>
            <div className="tc-row">
              <dt>Depart</dt>
              <dd>
                {offer.departAt
                  ? new Date(String(offer.departAt)).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div className="tc-row">
              <dt>Arrive</dt>
              <dd>
                {offer.arriveAt
                  ? new Date(String(offer.arriveAt)).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div className="tc-row">
              <dt>Cabin</dt>
              <dd>{text(offer.cabin, "Economy")}</dd>
            </div>
          </>
        ) : null}
        {kind === "car" ? (
          <>
            <div className="tc-row">
              <dt>Company</dt>
              <dd>{text(offer.company)}</dd>
            </div>
            <div className="tc-row">
              <dt>Pickup</dt>
              <dd>
                {text(offer.pickupLocation)}
                <br />
                {pickupAt || offer.pickupAt
                  ? new Date(String(pickupAt || offer.pickupAt)).toLocaleString()
                  : ""}
              </dd>
            </div>
            <div className="tc-row">
              <dt>Drop-off</dt>
              <dd>
                {text(offer.dropoffLocation || offer.pickupLocation)}
                <br />
                {dropoffAt || offer.dropoffAt
                  ? new Date(String(dropoffAt || offer.dropoffAt)).toLocaleString()
                  : ""}
              </dd>
            </div>
          </>
        ) : null}
        <div className="tc-row">
          <dt>Base fare</dt>
          <dd>{formatTravelMoney(fareCents, currency)}</dd>
        </div>
        <div className="tc-row">
          <dt>Taxes & fees</dt>
          <dd>{formatTravelMoney(taxAmountCents, currency)}</dd>
        </div>
        <div className="tc-row">
          <dt>Service fee</dt>
          <dd>{formatTravelMoney(serviceFeeCents, currency)}</dd>
        </div>
        <div className="tc-row tc-row--total">
          <dt>Total due</dt>
          <dd>{formatTravelMoney(totalAmountCents, currency)}</dd>
        </div>
      </dl>
    </section>
  );
}
