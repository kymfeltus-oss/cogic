import OwnerProductionSideMenu from "@/components/owner/OwnerProductionSideMenu";
import TravelManagementClient from "@/components/owner/TravelManagementClient";

export const dynamic = "force-dynamic";

export default function OwnerTravelPage() {
  return (
    <main className="min-h-dvh bg-black p-3 text-white">
      <div className="mx-auto grid max-w-[112rem] gap-3 xl:grid-cols-[12rem_1fr]">
        <OwnerProductionSideMenu active="travel" />
        <div>
          <h1 className="text-3xl font-bold">COGIC Travel Operations</h1>
          <p className="mt-2 text-white/60">
            Live Transactional Ledger over <code>travel_marketplace_booking_attempts</code> and{" "}
            <code>travel_booking_transactions</code>. Supplier webhooks at{" "}
            <code>/api/travel/webhooks/supplier</code> validate/decrypt partner payloads, write{" "}
            <code>travel_booking_transaction_events</code>, and update My Trip. Row actions: partner
            status sync, Stripe reversal, and override comments.
          </p>
          <TravelManagementClient />
        </div>
      </div>
    </main>
  );
}
