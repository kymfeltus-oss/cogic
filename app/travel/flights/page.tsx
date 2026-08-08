import FlightSearchPanel from "@/components/travel/FlightSearchPanel";
import { TravelShell } from "@/components/travel/TravelShell";

export default function Page() {
  return (
    <TravelShell back>
      <div className="ct-route-heading">
        <p className="ct-travel-eyebrow">COGIC TRAVEL</p>
        <h1>Flights to St. Louis</h1>
        <p>Destination: STL — St. Louis Lambert International Airport</p>
      </div>
      <FlightSearchPanel showHeading={false} />
    </TravelShell>
  );
}
