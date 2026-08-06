import type { EventType, OccurrenceStatus } from "@/lib/events/types";

/** Explicit allowlist for authenticated My Convocation dashboard serialization. */
export const MY_CONVOCATION_DTO_FIELDS = [
  "attendee",
  "registration",
  "credential",
  "nowNext",
  "todaySchedule",
  "todayScheduleMessage",
  "upcomingEvents",
  "experiences",
  "live",
  "replays",
  "support",
  "subsystemAvailability",
] as const;

export type MyConvocationAttendeeDTO = {
  displayName: string;
  greetingName: string;
};

export type RegistrationSummaryKind =
  | "none"
  | "draft"
  | "submitted"
  | "payment_pending"
  | "confirmed"
  | "canceled"
  | "refunded";

export type RegistrationActionDTO = {
  label: string;
  href: string;
};

export type RegistrationSummaryDTO = {
  kind: RegistrationSummaryKind;
  headline: string;
  body: string;
  statusLabel: string;
  reference: string | null;
  primaryAction: RegistrationActionDTO | null;
};

export type CredentialSummaryKind =
  | "not_applicable"
  | "not_issued"
  | "issued"
  | "active"
  | "expired"
  | "revoked"
  | "rotated";

export type CredentialSummaryDTO = {
  kind: CredentialSummaryKind;
  headline: string;
  body: string;
  statusLabel: string | null;
  badgeCode: string | null;
  expiresLabel: string | null;
  reaccessNote: string;
};

export type ScheduleOccurrenceDTO = {
  occurrenceKey: string;
  title: string;
  eventType: EventType;
  localDate: string;
  timeLabel: string;
  timeSecondaryLabel: string | null;
  venueLabel: string | null;
  status: OccurrenceStatus;
  isLiveNow: boolean;
};

export type NowNextState =
  | "live_now"
  | "next_event"
  | "no_events_today"
  | "no_schedule";

export type NowNextDTO = {
  state: NowNextState;
  contextLabel: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  primaryAction: RegistrationActionDTO | null;
};

export type LiveStatusDTO = {
  isLive: boolean;
  statusLabel: string;
  message: string;
  watchAction: RegistrationActionDTO | null;
};

export type ExperienceAvailability = "available" | "not_scheduled" | "completed";

export type ExperienceDirectoryEntryDTO = {
  entryKey: string;
  eventType: EventType | null;
  label: string;
  description: string;
  availability: ExperienceAvailability;
  nextLabel: string | null;
  href: string | null;
};

export type ReplaysSummaryDTO = {
  available: boolean;
  message: string;
};

export type SupportSummaryDTO = {
  registrationSupportLabel: string;
  registrationSupportHref: string;
  credentialHelpLabel: string;
};

export type SubsystemAvailabilityDTO = {
  registration: boolean;
  credential: boolean;
  schedule: boolean;
  live: boolean;
};

export type MyConvocationDashboardDTO = {
  attendee: MyConvocationAttendeeDTO;
  registration: RegistrationSummaryDTO;
  credential: CredentialSummaryDTO;
  nowNext: NowNextDTO;
  todaySchedule: ScheduleOccurrenceDTO[];
  todayScheduleMessage: string;
  upcomingEvents: ScheduleOccurrenceDTO[];
  experiences: ExperienceDirectoryEntryDTO[];
  live: LiveStatusDTO;
  replays: ReplaysSummaryDTO;
  support: SupportSummaryDTO;
  subsystemAvailability: SubsystemAvailabilityDTO;
};
