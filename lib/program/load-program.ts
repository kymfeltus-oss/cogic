import "server-only";

import { getPublishedOccurrences } from "@/lib/events/repository";
import type { PublishedOccurrence } from "@/lib/events/types";
import { fetchManifestStreamConfig } from "@/lib/live/fetch-manifest-stream-config";
import { buildProgramViewState } from "@/lib/program/build-program";
import type { ProgramViewState } from "@/lib/program/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type LoadConvocationProgramInput = {
  day?: string;
  category?: string;
  search?: string;
};

export type ConvocationProgramData = {
  occurrences: PublishedOccurrence[];
  broadcastIsLive: boolean;
  view: ProgramViewState;
};

export async function loadConvocationProgram(
  input: LoadConvocationProgramInput = {},
): Promise<ConvocationProgramData> {
  let occurrences: PublishedOccurrence[] = [];

  try {
    occurrences = await getPublishedOccurrences();
  } catch (error) {
    console.warn("[PROGRAM_SCHEDULE_UNAVAILABLE]", {
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }

  let broadcastIsLive = false;

  try {
    const admin = getSupabaseAdmin();
    const manifest = await fetchManifestStreamConfig(admin);
    if (!manifest.error) {
      broadcastIsLive = manifest.config?.is_live === true;
    }
  } catch (error) {
    console.warn("[PROGRAM_LIVE_STATUS_UNAVAILABLE]", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  const view = buildProgramViewState({
    occurrences,
    broadcastIsLive,
    dayParam: input.day,
    categoryParam: input.category,
    searchParam: input.search,
  });

  return { occurrences, broadcastIsLive, view };
}
