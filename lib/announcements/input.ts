import {
  isAllowedAnnouncementCtaHref,
  isAnnouncementAudience,
  isAnnouncementCategory,
  isAnnouncementPriority,
  type AnnouncementAudience,
  type AnnouncementCategory,
  type AnnouncementPriority,
} from "@/lib/announcements/types";

export type AnnouncementWriteInput = {
  title: string;
  body: string;
  summary: string | null;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  pinned: boolean;
  eventOccurrenceId: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  scheduledAt: string | null;
  expiresAt: string | null;
};

function optionalTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseIsoOrNull(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${field} must be an ISO timestamp string.`);
  }
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) {
    throw new Error(`${field} must be a valid timestamp.`);
  }
  return new Date(ts).toISOString();
}

export function parseAnnouncementWriteInput(
  body: Record<string, unknown> | null,
): AnnouncementWriteInput {
  if (!body) throw new Error("Request body is required.");

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.body === "string" ? body.body.trim() : "";
  if (!title) throw new Error("title is required.");
  if (!content) throw new Error("body is required.");

  const categoryRaw = typeof body.category === "string" ? body.category.trim() : "general";
  const priorityRaw = typeof body.priority === "string" ? body.priority.trim() : "normal";
  const audienceRaw =
    typeof body.audience === "string" ? body.audience.trim() : "all_authenticated";

  if (!isAnnouncementCategory(categoryRaw)) throw new Error("Invalid category.");
  if (!isAnnouncementPriority(priorityRaw)) throw new Error("Invalid priority.");
  if (!isAnnouncementAudience(audienceRaw)) throw new Error("Invalid audience.");

  const ctaHref = optionalTrimmed(body.ctaHref);
  const ctaLabel = optionalTrimmed(body.ctaLabel);
  if (ctaHref && !isAllowedAnnouncementCtaHref(ctaHref)) {
    throw new Error("ctaHref must be an approved internal route.");
  }
  if (ctaHref && !ctaLabel) {
    throw new Error("ctaLabel is required when ctaHref is set.");
  }

  const eventOccurrenceId = optionalTrimmed(body.eventOccurrenceId);
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (eventOccurrenceId && !uuid.test(eventOccurrenceId)) {
    throw new Error("eventOccurrenceId must be a valid UUID.");
  }

  return {
    title,
    body: content,
    summary: optionalTrimmed(body.summary),
    category: categoryRaw,
    priority: priorityRaw,
    audience: audienceRaw,
    pinned: body.pinned === true,
    eventOccurrenceId,
    ctaLabel,
    ctaHref,
    scheduledAt: parseIsoOrNull(body.scheduledAt, "scheduledAt"),
    expiresAt: parseIsoOrNull(body.expiresAt, "expiresAt"),
  };
}
