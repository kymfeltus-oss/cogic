import Link from "next/link";
import { TravelShell } from "@/components/travel/TravelShell";
import TravelGroupRequestsClient from "@/components/travel/TravelGroupRequestsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Group Travel Requests | COGIC Travel" };

export default function TravelGroupRequestsPage() {
  return (
    <TravelShell back>
      <div className="grid gap-4 py-4">
        <p className="text-sm uppercase tracking-[0.2em] text-white/55">Corporate travel</p>
        <h1 className="text-3xl font-bold text-white">Group booking requests</h1>
        <p className="max-w-2xl text-white/70">
          Churches with 10 or more travelers can request a corporate quote. Official hotel browse and
          marketplace booking remain on the Travel Hub.
        </p>
        <p className="text-sm text-white/55">
          <Link className="underline decoration-white/30 underline-offset-4" href="/travel">
            Return to Travel Hub
          </Link>
        </p>
        <TravelGroupRequestsClient />
      </div>
    </TravelShell>
  );
}
