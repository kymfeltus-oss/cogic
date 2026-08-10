import OwnerProductionSideMenu from "@/components/owner/OwnerProductionSideMenu";
import GivingFundsManagementClient from "@/components/owner/GivingFundsManagementClient";

export const dynamic = "force-dynamic";

export default function OwnerGivingPage() {
  return (
    <main className="min-h-dvh bg-black p-3 text-white">
      <div className="mx-auto grid max-w-[112rem] gap-3 xl:grid-cols-[12rem_1fr]">
        <OwnerProductionSideMenu active="giving" />
        <div>
          <h1 className="text-3xl font-bold">COGIC Giving Funds</h1>
          <p className="mt-1 text-white/70">
            Manage fund designations used by attendee Giving checkout. Active and
            published funds are the only designations available to attendees.
          </p>
          <div className="mt-4">
            <GivingFundsManagementClient />
          </div>
        </div>
      </div>
    </main>
  );
}
