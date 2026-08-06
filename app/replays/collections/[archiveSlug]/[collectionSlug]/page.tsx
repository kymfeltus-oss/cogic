import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Heart, Video } from "lucide-react";
import {
  getPublishedCollectionBySlug,
  listPublishedRecordingIdsForCollection,
} from "@/lib/archives/repository";
import { loadPublishedReplays } from "@/lib/replays/load-published-replays";

export const dynamic = "force-dynamic";

type CollectionPageProps = {
  params: Promise<{ archiveSlug: string; collectionSlug: string }>;
};

export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const { archiveSlug, collectionSlug } = await params;
  const result = await getPublishedCollectionBySlug(
    decodeURIComponent(archiveSlug),
    decodeURIComponent(collectionSlug),
  ).catch(() => null);
  return {
    title: result
      ? `${result.collection.title} | ${result.archive.title}`
      : "Collection | COGIC LIVE",
  };
}

export default async function CollectionDetailPage({ params }: CollectionPageProps) {
  const { archiveSlug, collectionSlug } = await params;
  const result = await getPublishedCollectionBySlug(
    decodeURIComponent(archiveSlug),
    decodeURIComponent(collectionSlug),
  ).catch(() => null);

  if (!result) {
    return (
      <main id="main-content" className="responsive-page bg-brand-black px-5 py-16 text-white">
        <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
          <h1 className="font-headline text-4xl">Collection unavailable</h1>
          <p className="mt-4 text-white/70">
            This collection is not published or does not exist.
          </p>
          <Link href="/replays" className="mt-8 inline-flex text-brand-blue">
            <ArrowLeft className="mr-2 size-4" aria-hidden="true" /> Back to replays
          </Link>
        </section>
      </main>
    );
  }

  const { archive, collection } = result;
  const recordingIds = await listPublishedRecordingIdsForCollection(collection.id);
  const idSet = new Set(recordingIds);
  const replays = (await loadPublishedReplays()).filter((replay) => idSet.has(replay.id));

  return (
    <main
      id="main-content"
      className="responsive-page pb-[calc(6rem+env(safe-area-inset-bottom,0px))] bg-brand-black text-white"
    >
      <div className="responsive-container py-8">
        <Link
          href={`/replays/archive/${archive.slug}`}
          className="inline-flex items-center gap-2 text-sm text-brand-blue"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> {archive.title}
        </Link>
        <header className="mt-6 max-w-3xl">
          <p className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
            {archive.year} · Collection
          </p>
          <h1 className="mt-3 font-headline text-4xl sm:text-5xl">{collection.title}</h1>
          {collection.description ? (
            <p className="mt-4 text-white/75">{collection.description}</p>
          ) : null}
          <Link
            href={`/giving?sourceType=collection&collectionId=${encodeURIComponent(collection.id)}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-blue px-5 py-3 font-ui text-sm font-bold text-brand-black"
          >
            <Heart className="size-4" aria-hidden="true" /> Give from this collection
          </Link>
        </header>

        <section className="mt-10" aria-labelledby="collection-replays-heading">
          <h2 id="collection-replays-heading" className="font-headline text-2xl">
            Replays
          </h2>
          {replays.length === 0 ? (
            <p className="mt-4 text-white/65">
              No published replays are assigned to this collection yet.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {replays.map((replay) => (
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
