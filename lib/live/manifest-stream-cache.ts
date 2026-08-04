import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchManifestStreamConfig,
  type ManifestStreamConfig,
} from "@/lib/live/fetch-manifest-stream-config";

const CACHE_TTL_MS = 30_000;

type CacheEntry = {
  config: ManifestStreamConfig | null;
  error: string | null;
  selectUsed: string | null;
  expiresAt: number;
};

let memoryCache: CacheEntry | null = null;
let inflight: Promise<Omit<CacheEntry, "expiresAt">> | null = null;

function isFresh(entry: CacheEntry | null): entry is CacheEntry {
  return Boolean(entry && Date.now() < entry.expiresAt);
}

async function loadManifestStreamConfigUncached(
  admin: SupabaseClient,
): Promise<Omit<CacheEntry, "expiresAt">> {
  const result = await fetchManifestStreamConfig(admin);

  if (result.error || !result.config) {
    return {
      config: null,
      error: result.error ?? "Stream configuration row missing.",
      selectUsed: result.selectUsed,
    };
  }

  return {
    config: result.config,
    error: null,
    selectUsed: result.selectUsed,
  };
}

/** Process-local cache — avoids repeated Supabase round-trips within TTL window. */
export async function getCachedManifestStreamConfig(
  admin: SupabaseClient,
): Promise<Omit<CacheEntry, "expiresAt">> {
  if (isFresh(memoryCache)) {
    return {
      config: memoryCache.config,
      error: memoryCache.error,
      selectUsed: memoryCache.selectUsed,
    };
  }

  if (inflight) return inflight;

  inflight = loadManifestStreamConfigUncached(admin)
    .then((loaded) => {
      memoryCache = {
        ...loaded,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      return loaded;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function invalidateManifestStreamCache(): void {
  memoryCache = null;
}
