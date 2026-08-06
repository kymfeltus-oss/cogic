export type ConvocationArchive = {
  id: string;
  programKey: string;
  convocationNumber: number;
  year: number;
  slug: string;
  title: string;
  description: string | null;
  published: boolean;
  sortOrder: number;
};

export type MediaCollection = {
  id: string;
  archiveId: string;
  programKey: string;
  key: string;
  slug: string;
  title: string;
  description: string | null;
  published: boolean;
  sortOrder: number;
};

export type MediaCollectionRecording = {
  collectionId: string;
  recordingId: string;
  sortOrder: number;
};

export function slugifyArchivePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
