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
            Manage official hotel availability, attendee reservations, Getting Around
            guidance, and travel provider configuration status. Flight and car inventory
            remain unavailable until a live provider is connected.
          </p>
          <TravelManagementClient />
        </div>
      </div>
    </main>
  );
}
