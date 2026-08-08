import RentalCarSearchPanel from "@/components/travel/RentalCarSearchPanel";
import { TravelShell } from "@/components/travel/TravelShell";

export default function Page() {
  return (
    <TravelShell back>
      <div className="ct-route-heading">
        <p className="ct-travel-eyebrow">COGIC TRAVEL</p>
        <h1>Rental Cars</h1>
        <p>Plan ground travel in St. Louis with the details that fit your stay.</p>
      </div>
      <RentalCarSearchPanel showHeading={false} />
    </TravelShell>
  );
}
