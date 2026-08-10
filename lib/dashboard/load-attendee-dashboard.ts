import "server-only";

import { getUserFromSession } from "@/lib/auth/session";
import { hydrateAuthMetadataFromAttendee } from "@/lib/auth/sync-attendee-profile";
import { getPublishedOccurrences } from "@/lib/events/repository";
import type { PublishedOccurrence } from "@/lib/events/types";
import { fetchAttendeeProfileRecord } from "@/lib/experience/fetch-attendee-profile";
import { fetchManifestStreamConfig } from "@/lib/live/fetch-manifest-stream-config";
import { resolveAuthoritativeLiveState } from "@/lib/live/authoritative-state";
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
import { loadPublishedReplays, type PublishedReplay } from "@/lib/replays/load-published-replays";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  type DashboardHousingSummary,
  type DashboardTicketsSummary,
} from "@/lib/dashboard/dashboard-module-summaries";
import { loadDashboardHousingSummary } from "@/lib/dashboard/load-dashboard-housing";
import { loadDashboardTicketsSummary } from "@/lib/dashboard/load-dashboard-tickets";

export type DashboardRegistrationState = {
  status: RegistrationStatus | "none";
  credentialReady: boolean;
  productName: string | null;
  groupSize: number;
  policyAccepted: boolean;
  registrationId: string | null;
  registeredAt: string | null;
  paymentStatus: string | null;
  policy: { version: string; acceptedAt: string; signerName: string; snapshot: string } | null;
  members: Array<{
    registrationId: string;
    name: string;
    relationship: string | null;
    isJunior: boolean;
    guardianName: string | null;
    productName: string | null;
    status: string;
    credentialStatus: string;
    confirmationReference: string | null;
    interpretationLanguage: string | null;
  }>;
};

export type AttendeeDashboardData = {
  profile: ReturnType<typeof buildAttendeeProfileSnapshot>;
  live: {
    isLive: boolean;
    title: string | null;
    nextTitle: string | null;
    nextTime: string | null;
    featuredReplay: PublishedReplay | null;
  };
  recentReplays: PublishedReplay[];
  schedule: ScheduleOccurrenceDTO[];
  scheduleAvailable: boolean;
  scheduleError: string | null;
  registration: DashboardRegistrationState;
  registrationError: string | null;
  tickets: DashboardTicketsSummary;
  housing: DashboardHousingSummary;
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

type RegistrationMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  relationship_to_primary: string | null;
  is_primary_registrant: boolean;
  guardian_registration_id: string | null;
  status: string;
  confirmation_reference: string | null;
  requires_interpretation: boolean;
  preferred_language: string | null;
  registration_products: { name?: string } | Array<{ name?: string }> | null;
  registration_credentials: Array<{ status?: string }> | null;
};

async function registrationExperienceSummary(registrationId: string) {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("registrations")
    .select(
      "registration_group_id,created_at,registration_products(name),registration_payments(status)",
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!data) {
    return {
      productName: null,
      groupSize: 0,
      policyAccepted: false,
      registrationId: null,
      registeredAt: null,
      paymentStatus: null,
      policy: null,
      members: [],
    };
  }
  const groupId = data.registration_group_id as string | null;
  const [memberRows, acceptance] = groupId
    ? await Promise.all([
        db
          .from("registrations")
          .select(
            "id,first_name,last_name,relationship_to_primary,is_primary_registrant,guardian_registration_id,date_of_birth,status,confirmation_reference,requires_interpretation,preferred_language,registration_products(name),registration_credentials(status)",
          )
          .eq("registration_group_id", groupId)
          .order("is_primary_registrant", { ascending: false }),
        db
          .from("registration_policy_acceptances")
          .select("policy_version,policy_snapshot,agreement_signer_name,accepted_at")
          .eq("registration_group_id", groupId)
          .limit(1)
          .maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];
  const product = Array.isArray(data.registration_products)
    ? data.registration_products[0]
    : data.registration_products;
  const rawMembers = (memberRows.data ?? []) as RegistrationMemberRow[];
  const names = new Map(
    rawMembers.map((row) => [row.id, `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim()]),
  );
  const members = rawMembers.map((row) => {
    const p = Array.isArray(row.registration_products)
      ? row.registration_products[0]
      : row.registration_products;
    const credentials = Array.isArray(row.registration_credentials)
      ? row.registration_credentials
      : [];
    const c = credentials.at(-1);
    return {
      registrationId: row.id,
      name: names.get(row.id) || "Registrant",
      relationship: row.is_primary_registrant ? "Primary" : row.relationship_to_primary,
      isJunior: row.relationship_to_primary === "child",
      guardianName: row.guardian_registration_id
        ? names.get(row.guardian_registration_id) ?? "Guardian"
        : null,
      productName: p?.name ?? null,
      status: row.status,
      credentialStatus: c?.status ?? "not_issued",
      confirmationReference: row.confirmation_reference ?? null,
      interpretationLanguage: row.requires_interpretation
        ? row.preferred_language ?? "Requested"
        : null,
    };
  });
  const accepted = acceptance.data;
  const payments = Array.isArray(data.registration_payments) ? data.registration_payments : [];
  return {
    productName: (product as { name?: string } | null)?.name ?? null,
    groupSize: members.length || 1,
    policyAccepted: Boolean(accepted),
    registrationId,
    registeredAt: data.created_at as string,
    paymentStatus: payments[0]?.status ?? null,
    policy: accepted
      ? {
          version: accepted.policy_version,
          acceptedAt: accepted.accepted_at,
          signerName: accepted.agreement_signer_name,
          snapshot: accepted.policy_snapshot,
        }
      : null,
    members,
  };
}

const emptyRegistration: DashboardRegistrationState = {
  status: "none",
  credentialReady: false,
  productName: null,
  groupSize: 0,
  policyAccepted: false,
  registrationId: null,
  registeredAt: null,
  paymentStatus: null,
  policy: null,
  members: [],
};

export async function loadAttendeeDashboard(): Promise<AttendeeDashboardData> {
  let user = await getUserFromSession();
  let attendeeRecord = user ? await fetchAttendeeProfileRecord(user.id) : null;
  if (user) {
    user = await hydrateAuthMetadataFromAttendee(user);
    attendeeRecord ??= await fetchAttendeeProfileRecord(user.id);
  }

  const profile = buildAttendeeProfileSnapshot(user, attendeeRecord);
  const userId = user?.id ?? null;

  const [
    occurrencesResult,
    manifestResult,
    replaysResult,
    registrationResult,
    ticketsResult,
    housingResult,
  ] = await Promise.allSettled([
    getPublishedOccurrences(),
    fetchManifestStreamConfig(getSupabaseAdmin()),
    loadPublishedReplays(),
    userId ? getRegistrationForUser({ userId }) : Promise.resolve(null),
    loadDashboardTicketsSummary(userId),
    loadDashboardHousingSummary(userId),
  ]);

  const scheduleError =
    occurrencesResult.status === "rejected" ? "Unable to load schedule." : null;
  const registrationError =
    registrationResult.status === "rejected" ? "Unable to load registration." : null;

  const occurrences = occurrencesResult.status === "fulfilled" ? occurrencesResult.value : [];
  const manifest = manifestResult.status === "fulfilled" ? manifestResult.value.config : null;
  const registration =
    registrationResult.status === "fulfilled" ? registrationResult.value : null;
  // Dashboard stage: only an authoritative LIVE broadcast is playable here.
  // Catalog replays appear under Highlights — never auto-promoted as PLAYING NOW.
  const featuredReplay = null;
  const tickets =
    ticketsResult.status === "fulfilled"
      ? ticketsResult.value
      : {
          available: false,
          error: "Unable to load tickets.",
          validCount: 0,
          revokedCount: 0,
          summary: "Unable to load tickets.",
          cta: "Try again",
        };
  const housing =
    housingResult.status === "fulfilled"
      ? housingResult.value
      : {
          available: false,
          error: "Unable to load housing.",
          preference: null,
          status: null,
          hotelName: null,
          blockName: null,
          arrival: null,
          departure: null,
          summary: "Unable to load housing.",
          cta: "Try again",
        };

  const lookup = buildOccurrenceLookup(occurrences);
  const today = getChicagoLocalDate();
  const todayOccurrences = occurrences.filter((item) => item.localDate === today).slice(0, 3);
  const liveOccurrence = activeOccurrence(occurrences);
  const nextOccurrence = resolveNextOccurrenceToday(occurrences);
  const liveStatus = resolveAuthoritativeLiveState(liveOccurrence, manifest);

  let registrationState = emptyRegistration;
  if (registration) {
    try {
      const summary = await registrationExperienceSummary(registration.id);
      registrationState = {
        status: registration.status ?? "none",
        credentialReady: await credentialReady(registration.id),
        ...summary,
      };
    } catch {
      registrationState = emptyRegistration;
    }
  }

  return {
    profile,
    live: {
      isLive: liveStatus === "live",
      title: liveOccurrence?.title ?? null,
      nextTitle: nextOccurrence?.title ?? null,
      nextTime: nextOccurrence
        ? mapPublishedOccurrenceToScheduleItem(nextOccurrence, lookup, false).timeLabel
        : null,
      featuredReplay,
    },
    recentReplays: replaysResult.status === "fulfilled" ? replaysResult.value.slice(0, 8) : [],
    schedule: todayOccurrences.map((item) =>
      mapPublishedOccurrenceToScheduleItem(item, lookup, item.status === "live"),
    ),
    scheduleAvailable: occurrences.length > 0,
    scheduleError,
    registration: registrationState,
    registrationError,
    tickets,
    housing,
  };
}
