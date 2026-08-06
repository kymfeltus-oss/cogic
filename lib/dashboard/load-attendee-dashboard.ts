import "server-only";

import { getUserFromSession } from "@/lib/auth/session";
import { hydrateAuthMetadataFromAttendee } from "@/lib/auth/sync-attendee-profile";
import { getPublishedOccurrences } from "@/lib/events/repository";
import type { PublishedOccurrence } from "@/lib/events/types";
import { fetchAttendeeProfileRecord } from "@/lib/experience/fetch-attendee-profile";
import { fetchManifestStreamConfig } from "@/lib/live/fetch-manifest-stream-config";
import {
  buildOccurrenceLookup,
  getChicagoLocalDate,
  mapPublishedOccurrenceToScheduleItem,
  resolveNextOccurrenceToday,
} from "@/lib/my-convocation/schedule";
import type { ScheduleOccurrenceDTO } from "@/lib/my-convocation/types";
import { buildAttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import { getRegistrationForUser } from "@/lib/registration/repository";
import type { RegistrationStatus } from "@/lib/registration/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type DashboardRegistrationState = {
  status: RegistrationStatus | "none";
  credentialReady: boolean;
};

export type AttendeeDashboardData = {
  profile: ReturnType<typeof buildAttendeeProfileSnapshot>;
  live: {
    isLive: boolean;
    title: string | null;
    nextTitle: string | null;
    nextTime: string | null;
  };
  schedule: ScheduleOccurrenceDTO[];
  scheduleAvailable: boolean;
  registration: DashboardRegistrationState;
};

function activeOccurrence(occurrences: PublishedOccurrence[]) {
  return occurrences.find((item) => item.status === "live") ?? null;
}

async function credentialReady(registrationId: string): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("registration_credentials")
      .select("status")
      .eq("registration_id", registrationId)
      .in("status", ["issued", "active"])
      .limit(1)
      .maybeSingle();
    return !error && data !== null;
  } catch {
    return false;
  }
}

export async function loadAttendeeDashboard(): Promise<AttendeeDashboardData> {
  let user = await getUserFromSession();
  let attendeeRecord = user ? await fetchAttendeeProfileRecord(user.id) : null;
  if (user) {
    user = await hydrateAuthMetadataFromAttendee(user);
    attendeeRecord ??= await fetchAttendeeProfileRecord(user.id);
  }

  const profile = buildAttendeeProfileSnapshot(user, attendeeRecord);
  const [occurrencesResult, manifestResult, registrationResult] = await Promise.allSettled([
    getPublishedOccurrences(),
    fetchManifestStreamConfig(getSupabaseAdmin()),
    user ? getRegistrationForUser({ userId: user.id }) : Promise.resolve(null),
  ]);

  const occurrences = occurrencesResult.status === "fulfilled" ? occurrencesResult.value : [];
  const manifest = manifestResult.status === "fulfilled" ? manifestResult.value.config : null;
  const registration =
    registrationResult.status === "fulfilled" ? registrationResult.value : null;
  const lookup = buildOccurrenceLookup(occurrences);
  const today = getChicagoLocalDate();
  const todayOccurrences = occurrences.filter((item) => item.localDate === today).slice(0, 3);
  const liveOccurrence = activeOccurrence(occurrences);
  const nextOccurrence = resolveNextOccurrenceToday(occurrences);

  return {
    profile,
    live: {
      isLive: manifest?.is_live === true,
      title: liveOccurrence?.title ?? null,
      nextTitle: nextOccurrence?.title ?? null,
      nextTime: nextOccurrence
        ? mapPublishedOccurrenceToScheduleItem(nextOccurrence, lookup, false).timeLabel
        : null,
    },
    schedule: todayOccurrences.map((item) =>
      mapPublishedOccurrenceToScheduleItem(item, lookup, item.status === "live"),
    ),
    scheduleAvailable: occurrences.length > 0,
    registration: {
      status: registration?.status ?? "none",
      credentialReady: registration ? await credentialReady(registration.id) : false,
    },
  };
}
