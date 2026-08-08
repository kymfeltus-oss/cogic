import type { Metadata } from "next";
import Link from "next/link";
import { Radio, Video } from "lucide-react";
import { listPublishedArchives } from "@/lib/archives/repository";
import { loadPublishedReplays } from "@/lib/replays/load-published-replays";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Replays | COGIC LIVE",
  description: "Published COGIC LIVE service replays.",
};

type ReplaysPageProps = { searchParams: Promise<{ q?: string; year?: string }> };

export default async function ReplaysPage({ searchParams }: ReplaysPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const year = params.year?.trim() ?? "";
  let replays: Awaited<ReturnType<typeof loadPublishedReplays>> = [];
  let continueWatching: Awaited<ReturnType<typeof loadPublishedReplays>> = [];
  let archives: Awaited<ReturnType<typeof listPublishedArchives>> = [];
  let loadError: string | null = null;

  try {
    replays = await loadPublishedReplays();
    archives = await listPublishedArchives().catch(() => []);
  } catch {
    loadError = "Unable to load replays right now. Please try again later.";
  }

  if (!loadError && replays.length > 0) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: progress } = await supabase
          .from("replay_watch_progress")
          .select("recording_id")
          .eq("user_id", user.id)
          .eq("completed", false)
          .gt("last_position_seconds", 5)
          .order("updated_at", { ascending: false })
          .limit(12);
        const ids = new Set((progress ?? []).map((row) => row.recording_id));
        continueWatching = replays.filter((replay) => ids.has(replay.id));
      }
    } catch {
      continueWatching = [];
    }
  }

  if (!loadError && (query || year)) {
    const normalizedQuery = query.toLocaleLowerCase();
    replays = replays.filter((replay) => {
      const matchesQuery = !normalizedQuery || [replay.title, replay.description ?? ""]
        .join(" ").toLocaleLowerCase().includes(normalizedQuery);
      return matchesQuery && (!year || replay.localDate.startsWith(year));
    });
  }

  return (
    <main
      id="main-content"
      className="responsive-page relative z-[1] pb-[calc(6rem+env(safe-area-inset-bottom,0px))] bg-transparent text-white"
    >
      <div className="responsive-container flex min-h-[min(42rem,75dvh)] flex-col justify-center py-8">
        {loadError ? (
          <section
            className="brand-card brand-card--info mx-auto w-full max-w-2xl p-[clamp(1.25rem,5vw,3rem)] text-center"
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
            className="brand-card brand-card--info mx-auto w-full max-w-2xl p-[clamp(1.25rem,5vw,3rem)] text-center"
            aria-labelledby="replays-empty-heading"
          >
            <Video className="mx-auto size-12 text-[#c62a9b]" aria-hidden="true" />
            <p className="mt-5 font-ui text-sm font-semibold uppercase tracking-[0.14em] text-[#c62a9b]">
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
              className="brand-card__cta touch-target mx-auto mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 font-ui text-sm font-bold text-white"
            >
              <Radio className="size-5" aria-hidden="true" />
              Watch Live
            </Link>
          </section>
        ) : (
          <section aria-labelledby="replays-heading" className="mx-auto w-full max-w-3xl">
            <header className="mb-8 text-center">
              <p className="font-ui text-sm font-semibold uppercase tracking-[0.14em] text-[#c62a9b]">
                Replays
              </p>
              <h1 id="replays-heading" className="mt-3 font-headline text-4xl">
                Published recordings
              </h1>
              <p className="mx-auto mt-3 max-w-prose font-body text-base text-white/75">
              Search and select a published replay to open the official recording.
            </p>
            <form method="get" className="glass-panel mb-6 flex flex-col gap-3 rounded-2xl p-3 sm:flex-row" role="search">
              <label className="sr-only" htmlFor="replay-search">Search replays</label>
              <input id="replay-search" name="q" defaultValue={query} placeholder="Search published replays" className="min-h-11 flex-1 rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-white/45 focus:border-brand-blue" />
              <label className="sr-only" htmlFor="replay-year">Filter by year</label>
              <input id="replay-year" name="year" defaultValue={year} inputMode="numeric" pattern="[0-9]{4}" placeholder="Year" className="min-h-11 w-full rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-white/45 focus:border-brand-blue sm:w-28" />
              <button type="submit" className="brand-card__cta touch-target px-5 py-2 font-ui text-sm font-bold text-white">Search</button>
            </form>
            {continueWatching.length > 0 ? (
              <section className="mb-7" aria-labelledby="continue-watching-heading">
                <h2 id="continue-watching-heading" className="mb-3 font-headline text-2xl">Continue Watching</h2>
                <ul className="flex flex-col gap-3">
                  {continueWatching.map((replay) => (
                    <li key={`continue-${replay.id}`}>
                      <Link href={`/replays/${encodeURIComponent(replay.id)}`} className="brand-card brand-card--feature block px-5 py-4 transition">
                        <p className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">Resume replay</p>
                        <p className="mt-1 font-headline text-xl text-white">{replay.title}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {archives.length > 0 ? (
              <section className="mb-7" aria-labelledby="archives-heading">
                <h2 id="archives-heading" className="mb-3 font-headline text-2xl">
                  Convocation archives
                </h2>
                <ul className="flex flex-col gap-3">
                  {archives.map((archive) => (
                    <li key={archive.id}>
                      <Link
                        href={`/replays/archive/${encodeURIComponent(archive.slug)}`}
                        className="brand-card brand-card--feature block px-5 py-4 transition"
                      >
                        <p className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
                          {archive.year}
                        </p>
                        <p className="mt-1 font-headline text-xl text-white">{archive.title}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            </header>
            <ul className="flex flex-col gap-4">
              {replays.map((replay) => (
                <li key={`${replay.occurrenceId}-${replay.id}`}>
                  <Link
                    href={`/replays/${encodeURIComponent(replay.id)}`}
                    className="brand-card brand-card--feature touch-target block px-5 py-4 transition"
                  >
                    <p className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
                      {replay.localDate}
                    </p>
                    <h2 className="mt-2 font-headline text-xl text-white">{replay.title}</h2>
                    {replay.description ? (
                      <p className="mt-2 font-body text-sm text-white/70">{replay.description}</p>
                    ) : null}
                    <p className="mt-3 font-ui text-xs font-bold uppercase tracking-[0.12em] text-brand-blue">
                      View replay
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
