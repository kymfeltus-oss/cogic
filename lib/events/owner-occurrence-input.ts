import {
  isOccurrenceStartMode,
  isOccurrenceStatus,
  isOccurrenceVisibility,
  type OccurrenceStartMode,
  type OccurrenceStatus,
  type OccurrenceVisibility,
} from "@/lib/events/types";
import { assertOccurrenceStatusTransition } from "@/lib/events/status";

export type OwnerOccurrenceWriteInput = {
  eventId: string;
  titleOverride: string | null;
  localDate: string;
  timezone: string;
  startMode: OccurrenceStartMode;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  estimatedStartAt: string | null;
  venueLabel: string | null;
  followsOccurrenceId: string | null;
  visibility: OccurrenceVisibility;
  status: OccurrenceStatus;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asIsoOrNull(value: unknown, field: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${field} must be an ISO datetime string.`);
  }
  const trimmed = value.trim();
  const ts = Date.parse(trimmed);
  if (!Number.isFinite(ts)) {
    throw new Error(`${field} must be a valid datetime.`);
  }
  return new Date(ts).toISOString();
}

/** Parse + validate owner create/update occurrence payloads. No invented defaults for schedule times. */
export function parseOwnerOccurrenceWriteInput(
  body: Record<string, unknown> | null,
  options?: { requireEventId?: boolean },
): OwnerOccurrenceWriteInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const requireEventId = options?.requireEventId !== false;
  const eventId =
    typeof body.eventId === "string" ? body.eventId.trim() : "";
  if (requireEventId && !eventId) {
    throw new Error("eventId is required.");
  }

  const localDate =
    typeof body.localDate === "string" ? body.localDate.trim() : "";
  if (!DATE_RE.test(localDate)) {
    throw new Error("localDate must be YYYY-MM-DD.");
  }

  const timezone =
    typeof body.timezone === "string" && body.timezone.trim()
      ? body.timezone.trim()
      : "America/Chicago";

  const startModeRaw =
    typeof body.startMode === "string" ? body.startMode.trim() : "fixed";
  if (!isOccurrenceStartMode(startModeRaw)) {
    throw new Error("Invalid startMode.");
  }

  const visibilityRaw =
    typeof body.visibility === "string" ? body.visibility.trim() : "unpublished";
  if (!isOccurrenceVisibility(visibilityRaw)) {
    throw new Error("Invalid visibility.");
  }

  const statusRaw =
    typeof body.status === "string" ? body.status.trim() : "scheduled";
  if (!isOccurrenceStatus(statusRaw)) {
    throw new Error("Invalid status.");
  }

  const scheduledStartAt = asIsoOrNull(body.scheduledStartAt, "scheduledStartAt");
  const scheduledEndAt = asIsoOrNull(body.scheduledEndAt, "scheduledEndAt");
  const estimatedStartAt = asIsoOrNull(body.estimatedStartAt, "estimatedStartAt");
  const followsOccurrenceId = asOptionalString(body.followsOccurrenceId);
  const venueLabel = asOptionalString(body.venueLabel);
  const titleOverride = asOptionalString(body.titleOverride);

  if (startModeRaw === "fixed" && !scheduledStartAt) {
    throw new Error("scheduledStartAt is required when startMode is fixed.");
  }
  if (startModeRaw === "after_predecessor" && !followsOccurrenceId) {
    throw new Error("followsOccurrenceId is required when startMode is after_predecessor.");
  }
  if (scheduledStartAt && scheduledEndAt) {
    if (Date.parse(scheduledEndAt) <= Date.parse(scheduledStartAt)) {
      throw new Error("scheduledEndAt must be after scheduledStartAt.");
    }
  }

  return {
    eventId,
    titleOverride,
    localDate,
    timezone,
    startMode: startModeRaw,
    scheduledStartAt,
    scheduledEndAt,
    estimatedStartAt,
    venueLabel,
    followsOccurrenceId,
    visibility: visibilityRaw,
    status: statusRaw,
  };
}

export function assertOwnerOccurrenceStatusChange(
  from: OccurrenceStatus,
  to: OccurrenceStatus,
): void {
  assertOccurrenceStatusTransition(from, to);
}

export function occurrenceRowFromWriteInput(
  input: OwnerOccurrenceWriteInput,
  actorUserId: string,
  mode: "create" | "update",
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    title_override: input.titleOverride,
    local_date: input.localDate,
    timezone: input.timezone,
    start_mode: input.startMode,
    scheduled_start_at: input.scheduledStartAt,
    scheduled_end_at: input.scheduledEndAt,
    estimated_start_at: input.estimatedStartAt,
    venue_label: input.venueLabel,
    follows_occurrence_id: input.followsOccurrenceId,
    visibility: input.visibility,
    status: input.status,
    updated_by: actorUserId,
  };

  if (mode === "create") {
    row.event_id = input.eventId;
    row.created_by = actorUserId;
  }

  return row;
}
