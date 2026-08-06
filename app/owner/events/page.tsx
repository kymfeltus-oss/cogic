import Link from "next/link";
import { Archive, Radio, Video } from "lucide-react";
import EventManagementClient from "@/components/owner/EventManagementClient";
import OwnerProductionSideMenu from "@/components/owner/OwnerProductionSideMenu";

export const dynamic = "force-dynamic";

export default function OwnerEventsPage() {
  return (
    <main className="min-h-dvh overflow-x-hidden overflow-y-auto bg-[#020203] bg-[radial-gradient(circle_at_22%_0%,rgba(0,168,255,0.13),transparent_28%),radial-gradient(circle_at_78%_4%,rgba(255,47,175,0.15),transparent_30%),linear-gradient(180deg,#050507_0%,#020203_54%,#010102_100%)] px-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 text-white">
      <div className="mx-auto grid min-h-[calc(100dvh-2.5rem)] w-full max-w-[112rem] gap-2 xl:grid-cols-[12rem_minmax(0,1fr)]">
        <OwnerProductionSideMenu active="events" />

        <div className="min-w-0">
          <header className="rounded-[6px] border border-white/10 bg-[#050814]/94 px-3 py-3 shadow-[0_0_28px_rgba(0,168,255,0.08)] sm:px-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-headline text-[1.45rem] uppercase leading-none tracking-[0.02em] sm:text-3xl lg:text-4xl">
                  <span className="text-[#00a8ff]">EVENT</span>{" "}
                  <span className="text-[#ff2faf]">OCCURRENCES</span>
                </p>
                <p className="mt-1 max-w-4xl font-ui text-[0.56rem] font-semibold uppercase tracking-[0.12em] text-white/72 sm:text-[0.68rem]">
                  Create and publish real schedule occurrences. Drafts stay private until
                  published.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/owner/control"
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-white/15 px-4 font-ui text-xs uppercase tracking-[0.12em] text-white"
                >
                  <Radio className="h-4 w-4" />
                  Broadcast
                </Link>
                <Link
                  href="/owner/replays"
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-white/15 px-4 font-ui text-xs uppercase tracking-[0.12em] text-white"
                >
                  <Video className="h-4 w-4" />
                  Replays
                </Link>
                <Link
                  href="/owner/archives"
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[#096bff] px-4 font-ui text-xs uppercase tracking-[0.12em] text-white"
                >
                  <Archive className="h-4 w-4" />
                  Archives
                </Link>
              </div>
            </div>
          </header>

          <div className="mt-2">
            <EventManagementClient />
          </div>
        </div>
      </div>
    </main>
  );
}
