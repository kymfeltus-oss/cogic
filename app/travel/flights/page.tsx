import { TravelShell } from "@/components/travel/TravelShell";
import FlightSearchPanel from "@/components/travel/FlightSearchPanel";

export const metadata = { title: "Flights | COGIC Travel" };

export default function TravelFlightsPage() {
  return (
    <TravelShell back>
      <FlightSearchPanel />
    </TravelShell>
  );
}
