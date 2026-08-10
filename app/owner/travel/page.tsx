import OwnerProductionSideMenu from "@/components/owner/OwnerProductionSideMenu";
import TravelManagementClient from "@/components/owner/TravelManagementClient";

export const dynamic = "force-dynamic";

export default function OwnerTravelPage() {
  return (
    <main className="min-h-dvh bg-black p-3 text-white">
      <div className="mx-auto grid max-w-[112rem] gap-3 xl:grid-cols-[12rem_1fr]">
        <OwnerProductionSideMenu active="travel" />
        <div>
          <h1 className="text-3xl font-bold">COGIC Travel</h1>
          <p className="mt-2 text-white/60">
            Manage official COGIC hotel availability, attendee reservations, Getting Around
            guidance, and marketplace provider status. US-wide hotel/flight/car search stays
            unavailable until Expedia Rapid and/or Duffel (or Enterprise Amadeus) credentials
            are configured on the server.
          </p>
          <TravelManagementClient />
        </div>
      </div>
    </main>
  );
}
