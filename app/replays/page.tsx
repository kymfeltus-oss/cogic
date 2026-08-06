import type { Metadata } from "next";
import Link from "next/link";
import { Radio, Video } from "lucide-react";
import { loadPublishedReplays } from "@/lib/replays/load-published-replays";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Replays | COGIC LIVE",
  description: "Published COGIC LIVE service replays.",
};

export default async function ReplaysPage() {
  let replays: Awaited<ReturnType<typeof loadPublishedReplays>> = [];
  let loadError: string | null = null;

  try {
    replays = await loadPublishedReplays();
  } catch {
    loadError = "Unable to load replays right now. Please try again later.";
  }

  return (
    <main
      id="main-content"
      className="responsive-page pb-[calc(6rem+env(safe-area-inset-bottom,0px))] bg-brand-black text-white"
    >
      <div className="responsive-container flex min-h-[min(42rem,75dvh)] flex-col justify-center py-8">
        {loadError ? (
          <section
            className="mx-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-[clamp(1.25rem,5vw,3rem)] text-center"
            aria-labelledby="replays-error-heading"
          >
            <h1 id="replays-error-heading" className="font-headline text-3xl">
              Replays unavailable
            </h1>
            <p className="mx-auto mt-4 max-w-prose font-body text-base leading-7 text-white/75">
              {loadError}
            </p>
          </section>
        ) : replays.length === 0 ? (
          <section
            className="mx-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-[clamp(1.25rem,5vw,3rem)] text-center shadow-2xl"
            aria-labelledby="replays-empty-heading"
          >
            <Video className="mx-auto size-12 text-brand-blue" aria-hidden="true" />
            <p className="mt-5 font-ui text-sm font-semibold uppercase tracking-[0.14em] text-brand-blue">
              Replays
            </p>
            <h1
              id="replays-empty-heading"
              className="mt-3 font-headline text-[clamp(2.25rem,8vw,4.5rem)] leading-none"
            >
              No replays published yet
            </h1>
            <p className="mx-auto mt-5 max-w-prose font-body text-base leading-7 text-white/75">
              Completed services appear here after the production team publishes an approved
              recording linked to a schedule occurrence.
            </p>
            <Link
              href="/live"
              className="touch-target mx-auto mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-brand-blue/50 bg-brand-blue/10 px-6 py-3 font-ui text-sm font-bold text-brand-blue"
            >
              <Radio className="size-5" aria-hidden="true" />
              Watch Live
            </Link>
          </section>
        ) : (
          <section aria-labelledby="replays-heading" className="mx-auto w-full max-w-3xl">
            <header className="mb-8 text-center">
              <p className="font-ui text-sm font-semibold uppercase tracking-[0.14em] text-brand-blue">
                Replays
              </p>
              <h1 id="replays-heading" className="mt-3 font-headline text-4xl">
                Published recordings
              </h1>
              <p className="mx-auto mt-3 max-w-prose font-body text-base text-white/75">
                Select a published replay to open the official recording.
              </p>
            </header>
            <ul className="flex flex-col gap-4">
              {replays.map((replay) => (
                <li key={`${replay.occurrenceId}-${replay.id}`}>
                  <a
                    href={replay.playbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="touch-target block rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 transition hover:border-brand-blue/40"
                  >
                    <p className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
                      {replay.localDate}
                    </p>
                    <h2 className="mt-2 font-headline text-xl text-white">{replay.title}</h2>
                    {replay.description ? (
                      <p className="mt-2 font-body text-sm text-white/70">{replay.description}</p>
                    ) : null}
                    <p className="mt-3 font-ui text-xs font-bold uppercase tracking-[0.12em] text-brand-blue">
                      Open recording
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
