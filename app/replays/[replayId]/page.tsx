import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Heart, Radio, Video } from "lucide-react";
import { loadPublishedReplayById } from "@/lib/replays/load-published-replays";
import ReplayPlayer from "@/components/replays/ReplayPlayer";
import ShareButton from "@/components/replays/ShareButton";

export const dynamic = "force-dynamic";

type ReplayDetailProps = { params: Promise<{ replayId: string }> };

export const metadata: Metadata = {
  title: "Replay | COGIC LIVE",
  description: "Watch a published COGIC LIVE replay.",
};

export default async function ReplayDetailPage({ params }: ReplayDetailProps) {
  const { replayId } = await params;
  const replay = await loadPublishedReplayById(decodeURIComponent(replayId));

  if (!replay) {
    return (
      <main id="main-content" className="responsive-page bg-brand-black px-5 py-16 text-white">
        <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
          <Video className="mx-auto size-12 text-brand-blue" aria-hidden="true" />
          <h1 className="mt-5 font-headline text-4xl">Replay unavailable</h1>
          <p className="mt-4 text-white/70">This recording is not published or is no longer available.</p>
          <Link href="/replays" className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-blue px-5 py-3 font-ui text-sm font-bold text-brand-black">
            <ArrowLeft className="size-4" aria-hidden="true" /> Browse replays
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" className="responsive-page bg-brand-black px-5 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link href="/replays" className="inline-flex items-center gap-2 text-sm text-brand-blue">
          <ArrowLeft className="size-4" aria-hidden="true" /> All replays
        </Link>
        <article className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          <ReplayPlayer recordingId={replay.id} playbackUrl={replay.playbackUrl} title={replay.title} />
          <div className="p-6 sm:p-8">
            <p className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">{replay.localDate}</p>
            <h1 className="mt-3 font-headline text-4xl leading-none sm:text-5xl">{replay.title}</h1>
            {replay.description ? <p className="mt-4 max-w-3xl text-white/75">{replay.description}</p> : null}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={`/giving?sourceType=replay&mediaId=${encodeURIComponent(replay.id)}&occurrenceId=${encodeURIComponent(replay.occurrenceId)}`}
                className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-5 py-3 font-ui text-sm font-bold text-brand-black"
              >
                <Heart className="size-4" aria-hidden="true" /> Give to COGIC
              </Link>
              <ShareButton title={replay.title} replayId={replay.id} />
              <Link href="/live" className="inline-flex items-center gap-2 rounded-full border border-brand-blue/40 px-5 py-3 font-ui text-sm font-bold text-brand-blue">
                <Radio className="size-4" aria-hidden="true" /> Watch Live
              </Link>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
