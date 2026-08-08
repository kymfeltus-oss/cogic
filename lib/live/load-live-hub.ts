import "server-only";

import { listPublishedArchives } from "@/lib/archives/repository";
import type { ConvocationArchive } from "@/lib/archives/types";
import { getUserFromSession } from "@/lib/auth/session";
import { getPublishedOccurrences } from "@/lib/events/repository";
import type { PublishedOccurrence } from "@/lib/events/types";
import { fetchAttendeeProfileRecord } from "@/lib/experience/fetch-attendee-profile";
import { resolveAuthoritativeLiveState } from "@/lib/live/authoritative-state";
import { fetchManifestStreamConfig } from "@/lib/live/fetch-manifest-stream-config";
import {
  buildOccurrenceLookup,
  mapPublishedOccurrenceToScheduleItem,
  resolveNextOccurrenceToday,
} from "@/lib/my-convocation/schedule";
import type { ScheduleOccurrenceDTO } from "@/lib/my-convocation/types";
import { buildAttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import {
  loadPublishedReplays,
  type PublishedReplay,
} from "@/lib/replays/load-published-replays";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type LiveHubHistoryItem = {
  replay: PublishedReplay;
  lastPositionSeconds: number;
  completed: boolean;
  updatedAt: string;
};

export type LiveHubData = {
  profile: AttendeeProfileSnapshot;
  authenticated: boolean;
  isLive: boolean;
  currentService: PublishedOccurrence | null;
  upNext: ScheduleOccurrenceDTO[];
  recentReplays: PublishedReplay[];
  featuredReplay: PublishedReplay | null;
  continueWatching: PublishedReplay[];
  favorites: PublishedReplay[];
  watchHistory: LiveHubHistoryItem[];
  archives: ConvocationArchive[];
  seedBalance: number | null;
};

function upcomingOccurrences(occurrences: PublishedOccurrence[]): PublishedOccurrence[] {
  const now = Date.now();
  return occurrences
    .filter((row) => {
      if (row.status === "live" || row.status === "canceled" || row.status === "completed") {
        return false;
      }
      const start = row.scheduledStartAt ?? row.estimatedStartAt;
      if (!start) return row.status === "next" || row.status === "starting_soon";
      const ts = Date.parse(start);
      return Number.isFinite(ts) ? ts >= now - 60_000 : true;
    })
    .slice(0, 6);
}

export async function loadLiveHub(): Promise<LiveHubData> {
  const user = await getUserFromSession();
  const attendeeRecord = user ? await fetchAttendeeProfileRecord(user.id) : null;
  const profile = buildAttendeeProfileSnapshot(user, attendeeRecord);

  const [occurrencesResult, manifestResult, replaysResult, archivesResult] =
    await Promise.allSettled([
      getPublishedOccurrences(),
      fetchManifestStreamConfig(getSupabaseAdmin()),
      loadPublishedReplays(),
      listPublishedArchives(),
    ]);

  const occurrences =
    occurrencesResult.status === "fulfilled" ? occurrencesResult.value : [];
  const manifest =
    manifestResult.status === "fulfilled" ? manifestResult.value.config : null;
  const replays = replaysResult.status === "fulfilled" ? replaysResult.value : [];
  const archives = archivesResult.status === "fulfilled" ? archivesResult.value : [];

  const liveOccurrence =
    occurrences.find((item) => item.status === "live") ?? null;
  const isLive =
    resolveAuthoritativeLiveState(liveOccurrence, manifest) === "live";
  const lookup = buildOccurrenceLookup(occurrences);
  const nextToday = resolveNextOccurrenceToday(occurrences);
  const upNextSource = upcomingOccurrences(occurrences);
  const upNextRows =
    upNextSource.length > 0
      ? upNextSource
      : nextToday
        ? [nextToday]
        : [];

  let continueWatching: PublishedReplay[] = [];
  let favorites: PublishedReplay[] = [];
  let watchHistory: LiveHubHistoryItem[] = [];
  let seedBalance: number | null = null;

  if (user && replays.length > 0) {
    try {
      const supabase = await createServerSupabaseClient();
      const [{ data: progress }, { data: favoriteRows }] = await Promise.all([
        supabase
          .from("replay_watch_progress")
          .select("recording_id, last_position_seconds, completed, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(24),
        supabase
          .from("replay_favorites")
          .select("recording_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(24),
      ]);

      const byId = new Map(replays.map((replay) => [replay.id, replay]));
      const continueIds = new Set(
        (progress ?? [])
          .filter(
            (row) =>
              row.completed !== true &&
              typeof row.last_position_seconds === "number" &&
              row.last_position_seconds > 5,
          )
          .map((row) => row.recording_id),
      );
      continueWatching = replays.filter((replay) => continueIds.has(replay.id)).slice(0, 8);

      const favoriteIds = new Set((favoriteRows ?? []).map((row) => row.recording_id));
      favorites = replays.filter((replay) => favoriteIds.has(replay.id)).slice(0, 8);

      watchHistory = (progress ?? [])
        .map((row) => {
          const replay = byId.get(row.recording_id);
          if (!replay) return null;
          return {
            replay,
            lastPositionSeconds:
              typeof row.last_position_seconds === "number" ? row.last_position_seconds : 0,
            completed: row.completed === true,
            updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
          } satisfies LiveHubHistoryItem;
        })
        .filter((row): row is LiveHubHistoryItem => row !== null)
        .slice(0, 8);
    } catch {
      continueWatching = [];
      favorites = [];
      watchHistory = [];
    }
  }

  if (user) {
    try {
      const admin = getSupabaseAdmin();
      const { data } = await admin
        .from("seed_wallets")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      if (typeof data?.balance === "number" && Number.isFinite(data.balance)) {
        seedBalance = data.balance;
      } else {
        seedBalance = 0;
      }
    } catch {
      seedBalance = null;
    }
  }

  return {
    profile,
    authenticated: Boolean(user),
    isLive,
    currentService: liveOccurrence,
    upNext: upNextRows.map((item) =>
      mapPublishedOccurrenceToScheduleItem(item, lookup, item.status === "live"),
    ),
    recentReplays: replays.slice(0, 8),
    featuredReplay: replays[0] ?? null,
    continueWatching,
    favorites,
    watchHistory,
    archives: archives.slice(0, 8),
    seedBalance,
  };
}
