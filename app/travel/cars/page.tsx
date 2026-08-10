import { TravelShell } from "@/components/travel/TravelShell";
import RentalCarSearchPanel from "@/components/travel/RentalCarSearchPanel";

export const metadata = { title: "Rental Cars | COGIC Travel" };

export default function TravelCarsPage() {
  return (
    <TravelShell back>
      <RentalCarSearchPanel />
    </TravelShell>
  );
}
