import Link from "next/link";
import { ArrowLeft, BedDouble, BriefcaseBusiness, Car, MapPinned, Plane } from "lucide-react";
import "@/app/travel/travel-home.css";

export function TravelShell({ children, back }: { children: React.ReactNode; back?: boolean }) {
  return (
    <main className="ct-travel-shell">
      <div className="ct-travel-shell__content">
        {back ? (
          <Link className="ct-back-link" href="/travel">
            <ArrowLeft />
            Back to COGIC Travel
          </Link>
        ) : null}
        {children}
      </div>
    </main>
  );
}

export const travelLinks = [
  { href: "/travel/hotels", label: "Hotels", icon: BedDouble },
  { href: "/travel/flights", label: "Flights", icon: Plane },
  { href: "/travel/cars", label: "Rental Cars", icon: Car },
  { href: "/travel/getting-around", label: "Getting Around", icon: MapPinned },
  { href: "/travel", label: "COGIC Travel Hub", icon: BriefcaseBusiness },
];

export function HonestUnavailable({ kind, embedded }: { kind: string; embedded?: boolean }) {
  const title =
    kind === "flight"
      ? "Flight search is being connected to our travel partners."
      : kind === "rental car"
        ? "Rental car search is being connected to our travel partners."
        : `Live ${kind} search coming soon`;

  return (
    <div className="ct-card ct-card--status ct-unavailable">
      <h2>{title}</h2>
      <p>
        A live travel provider has not been configured. We will never show invented prices or availability.
        {embedded ? null : " You can save a reservation made elsewhere in COGIC Travel."}
      </p>
      {embedded ? null : (
        <Link href="/travel" className="ct-button ct-unavailable__link">
          Open COGIC Travel Hub
        </Link>
      )}
    </div>
  );
}
