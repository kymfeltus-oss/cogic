import "server-only";

import { DEFAULT_PROGRAM_KEY } from "@/lib/events/types";
import type { ConvocationArchive, MediaCollection } from "@/lib/archives/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type ArchiveRow = {
  id: string;
  program_key: string;
  convocation_number: number;
  year: number;
  slug: string;
  title: string;
  description: string | null;
  published: boolean;
  sort_order: number;
};

type CollectionRow = {
  id: string;
  archive_id: string;
  program_key: string;
  key: string;
  slug: string;
  title: string;
  description: string | null;
  published: boolean;
  sort_order: number;
};

function mapArchive(row: ArchiveRow): ConvocationArchive {
  return {
    id: row.id,
    programKey: row.program_key,
    convocationNumber: row.convocation_number,
    year: row.year,
    slug: row.slug,
    title: row.title,
    description: row.description,
    published: row.published,
    sortOrder: row.sort_order,
  };
}

function mapCollection(row: CollectionRow): MediaCollection {
  return {
    id: row.id,
    archiveId: row.archive_id,
    programKey: row.program_key,
    key: row.key,
    slug: row.slug,
    title: row.title,
    description: row.description,
    published: row.published,
    sortOrder: row.sort_order,
  };
}

export async function listPublishedArchives(
  programKey: string = DEFAULT_PROGRAM_KEY,
): Promise<ConvocationArchive[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("convocation_archives")
    .select(
      "id, program_key, convocation_number, year, slug, title, description, published, sort_order",
    )
    .eq("program_key", programKey)
    .eq("published", true)
    .order("year", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Unable to load archives: ${error.message}`);
  return ((data ?? []) as ArchiveRow[]).map(mapArchive);
}

export async function getPublishedArchiveBySlug(
  slug: string,
  programKey: string = DEFAULT_PROGRAM_KEY,
): Promise<ConvocationArchive | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("convocation_archives")
    .select(
      "id, program_key, convocation_number, year, slug, title, description, published, sort_order",
    )
    .eq("program_key", programKey)
    .eq("slug", slug.trim())
    .eq("published", true)
    .maybeSingle();

  if (error) throw new Error(`Unable to load archive: ${error.message}`);
  return data ? mapArchive(data as ArchiveRow) : null;
}

export async function listPublishedCollectionsForArchive(
  archiveId: string,
): Promise<MediaCollection[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("media_collections")
    .select(
      "id, archive_id, program_key, key, slug, title, description, published, sort_order",
    )
    .eq("archive_id", archiveId)
    .eq("published", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Unable to load collections: ${error.message}`);
  return ((data ?? []) as CollectionRow[]).map(mapCollection);
}

export async function getPublishedCollectionBySlug(
  archiveSlug: string,
  collectionSlug: string,
  programKey: string = DEFAULT_PROGRAM_KEY,
): Promise<{ archive: ConvocationArchive; collection: MediaCollection } | null> {
  const archive = await getPublishedArchiveBySlug(archiveSlug, programKey);
  if (!archive) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("media_collections")
    .select(
      "id, archive_id, program_key, key, slug, title, description, published, sort_order",
    )
    .eq("archive_id", archive.id)
    .eq("slug", collectionSlug.trim())
    .eq("published", true)
    .maybeSingle();

  if (error) throw new Error(`Unable to load collection: ${error.message}`);
  if (!data) return null;
  return { archive, collection: mapCollection(data as CollectionRow) };
}

export async function listPublishedRecordingIdsForCollection(
  collectionId: string,
): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("media_collection_recordings")
    .select("recording_id, sort_order")
    .eq("collection_id", collectionId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Unable to load collection recordings: ${error.message}`);
  return (data ?? []).map((row) => row.recording_id as string);
}

/** Owner listing — includes unpublished. */
export async function listAllArchivesForOwner(
  programKey: string = DEFAULT_PROGRAM_KEY,
): Promise<ConvocationArchive[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("convocation_archives")
    .select(
      "id, program_key, convocation_number, year, slug, title, description, published, sort_order",
    )
    .eq("program_key", programKey)
    .order("year", { ascending: false });

  if (error) throw new Error(`Unable to load archives: ${error.message}`);
  return ((data ?? []) as ArchiveRow[]).map(mapArchive);
}

export async function listAllCollectionsForArchive(
  archiveId: string,
): Promise<MediaCollection[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("media_collections")
    .select(
      "id, archive_id, program_key, key, slug, title, description, published, sort_order",
    )
    .eq("archive_id", archiveId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Unable to load collections: ${error.message}`);
  return ((data ?? []) as CollectionRow[]).map(mapCollection);
}
