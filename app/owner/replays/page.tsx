import Link from "next/link";
import { Archive, MonitorPlay } from "lucide-react";
import OwnerProductionSideMenu from "@/components/owner/OwnerProductionSideMenu";
import ReplayManagementClient from "@/components/owner/ReplayManagementClient";

export const dynamic = "force-dynamic";

export default function OwnerReplaysPage() {
  return (
    <main className="min-h-dvh overflow-x-hidden overflow-y-auto bg-transparent px-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 text-white">
      <div className="mx-auto grid min-h-[calc(100dvh-2.5rem)] w-full max-w-[112rem] gap-2 xl:grid-cols-[12rem_minmax(0,1fr)]">
        <OwnerProductionSideMenu active="replays" />

        <div className="min-w-0">
          <header className="rounded-[6px] border border-white/10 bg-[#050814]/94 px-3 py-3 shadow-[0_0_28px_rgba(114,39,179,0.12)] sm:px-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-headline text-[1.45rem] uppercase leading-none tracking-[0.02em] sm:text-3xl lg:text-4xl">
                  <span className="text-[#8b39d0]">REPLAY</span>{" "}
                  <span className="text-[#c62a9b]">MANAGEMENT</span>
                </p>
                <p className="mt-1 max-w-4xl font-ui text-[0.56rem] font-semibold uppercase tracking-[0.12em] text-white/72 sm:text-[0.68rem]">
                  Ingest real recordings, link occurrences, publish / unpublish / archive —
                  no mock rows
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/owner/archives"
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-white/15 px-4 font-ui text-xs uppercase tracking-[0.12em] text-white"
                >
                  <Archive className="h-4 w-4" />
                  Archives
                </Link>
                <Link
                  href="/owner/cockpit"
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md brand-ombre-bg px-4 font-ui text-xs uppercase tracking-[0.12em] text-white"
                >
                  <MonitorPlay className="h-4 w-4" />
                  Open Cockpit
                </Link>
              </div>
            </div>
          </header>

          <div className="mt-2">
            <ReplayManagementClient />
          </div>
        </div>
      </div>
    </main>
  );
}
