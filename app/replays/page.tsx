import type { Metadata } from "next";
import Link from "next/link";
import { Radio, Video } from "lucide-react";

export const metadata: Metadata = {
  title: "Replays | COGIC Stream",
  description: "Published COGIC Stream service replays.",
};

export default function ReplaysPage() {
  return (
    <main id="main-content" className="responsive-page pb-[calc(6rem+env(safe-area-inset-bottom,0px))] bg-brand-black text-white">
      <div className="responsive-container flex min-h-[min(42rem,75dvh)] flex-col justify-center">
        <section className="mx-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-[clamp(1.25rem,5vw,3rem)] text-center shadow-2xl">
          <Video className="mx-auto size-12 text-brand-blue" aria-hidden="true" />
          <p className="mt-5 font-ui text-sm font-semibold uppercase tracking-[0.14em] text-brand-blue">Replays</p>
          <h1 className="mt-3 font-headline text-[clamp(2.25rem,8vw,4.5rem)] leading-none">No replays published yet</h1>
          <p className="mx-auto mt-5 max-w-prose font-body text-base leading-7 text-white/75">
            Completed services will appear here after the production team publishes an approved recording.
          </p>
          <Link href="/live" className="touch-target mx-auto mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-brand-blue/50 bg-brand-blue/10 px-6 py-3 font-ui text-sm font-bold text-brand-blue">
            <Radio className="size-5" aria-hidden="true" />
            Watch Live
          </Link>
        </section>
      </div>
    </main>
  );
}
