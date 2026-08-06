import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FolderOpen, Video } from "lucide-react";
import {
  getPublishedArchiveBySlug,
  listPublishedCollectionsForArchive,
} from "@/lib/archives/repository";
import { loadPublishedReplays } from "@/lib/replays/load-published-replays";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ArchivePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: ArchivePageProps): Promise<Metadata> {
  const { slug } = await params;
  const archive = await getPublishedArchiveBySlug(decodeURIComponent(slug)).catch(
    () => null,
  );
  return {
    title: archive ? `${archive.title} | COGIC LIVE` : "Archive | COGIC LIVE",
    description: archive?.description ?? "Published Convocation archive.",
  };
}

export default async function ArchiveDetailPage({ params }: ArchivePageProps) {
  const { slug } = await params;
  const archive = await getPublishedArchiveBySlug(decodeURIComponent(slug)).catch(
    () => null,
  );

  if (!archive) {
    return (
      <main id="main-content" className="responsive-page bg-brand-black px-5 py-16 text-white">
        <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
          <FolderOpen className="mx-auto size-12 text-brand-blue" aria-hidden="true" />
          <h1 className="mt-5 font-headline text-4xl">Archive unavailable</h1>
          <p className="mt-4 text-white/70">
            This Convocation archive is not published or does not exist.
          </p>
          <Link href="/replays" className="mt-8 inline-flex text-brand-blue">
            <ArrowLeft className="mr-2 size-4" aria-hidden="true" /> Back to replays
          </Link>
        </section>
      </main>
    );
  }

  const collections = await listPublishedCollectionsForArchive(archive.id);
  const allReplays = await loadPublishedReplays();
  const { data: linked } = await getSupabaseAdmin()
    .from("past_broadcast_recordings")
    .select("id")
    .eq("archive_id", archive.id)
    .eq("publication_status", "published");
  const archiveReplayIds = new Set((linked ?? []).map((row) => row.id as string));
  const archiveReplays = allReplays.filter(
    (replay) =>
      archiveReplayIds.has(replay.id) ||
      replay.localDate.startsWith(String(archive.year)),
  );

  return (
    <main
      id="main-content"
      className="responsive-page pb-[calc(6rem+env(safe-area-inset-bottom,0px))] bg-brand-black text-white"
    >
      <div className="responsive-container py-8">
        <Link href="/replays" className="inline-flex items-center gap-2 text-sm text-brand-blue">
          <ArrowLeft className="size-4" aria-hidden="true" /> All replays
        </Link>
        <header className="mt-6 max-w-3xl">
          <p className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
            {archive.year} Convocation archive
          </p>
          <h1 className="mt-3 font-headline text-4xl sm:text-5xl">{archive.title}</h1>
          {archive.description ? (
            <p className="mt-4 text-white/75">{archive.description}</p>
          ) : null}
        </header>

        <section className="mt-10" aria-labelledby="collections-heading">
          <h2 id="collections-heading" className="font-headline text-2xl">
            Collections
          </h2>
          {collections.length === 0 ? (
            <p className="mt-4 text-white/65">
              No published collections in this archive yet.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {collections.map((collection) => (
                <li key={collection.id}>
                  <Link
                    href={`/replays/collections/${archive.slug}/${collection.slug}`}
                    className="block rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 transition hover:border-brand-blue/40"
                  >
                    <h3 className="font-headline text-xl">{collection.title}</h3>
                    {collection.description ? (
                      <p className="mt-2 text-sm text-white/65">{collection.description}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12" aria-labelledby="archive-replays-heading">
          <h2 id="archive-replays-heading" className="font-headline text-2xl">
            Published replays
          </h2>
          {archiveReplays.length === 0 ? (
            <p className="mt-4 text-white/65">
              No published replays are linked to this archive yet.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {archiveReplays.map((replay) => (
                <li key={replay.id}>
                  <Link
                    href={`/replays/${replay.id}`}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 transition hover:border-brand-blue/40"
                  >
                    <Video className="mt-1 size-5 text-brand-blue" aria-hidden="true" />
                    <span>
                      <span className="block font-ui text-xs uppercase tracking-[0.14em] text-brand-blue">
                        {replay.localDate}
                      </span>
                      <span className="mt-1 block font-headline text-xl">{replay.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
