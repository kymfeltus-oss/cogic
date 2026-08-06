export const ANNOUNCEMENT_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "expired",
  "archived",
] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const ANNOUNCEMENT_PRIORITIES = ["normal", "important", "urgent"] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

export const ANNOUNCEMENT_CATEGORIES = [
  "general",
  "schedule",
  "venue",
  "transport",
  "safety",
  "leadership",
  "event",
] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const ANNOUNCEMENT_AUDIENCES = [
  "all_authenticated",
  "registered_attendees",
  "program_all",
] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

/** Allowlisted internal CTA destinations only — no arbitrary external injection. */
export const ANNOUNCEMENT_CTA_HREFS = [
  "/live",
  "/program",
  "/giving",
  "/replays",
  "/my-convocation",
  "/my-sanctuary",
  "/register",
  "/updates",
  "/contact-us",
] as const;

export type AnnouncementCtaHref = (typeof ANNOUNCEMENT_CTA_HREFS)[number];

export type Announcement = {
  id: string;
  programKey: string;
  title: string;
  summary: string | null;
  body: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  pinned: boolean;
  eventOccurrenceId: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  read?: boolean;
};

export function isAnnouncementStatus(value: string): value is AnnouncementStatus {
  return (ANNOUNCEMENT_STATUSES as readonly string[]).includes(value);
}

export function isAnnouncementPriority(value: string): value is AnnouncementPriority {
  return (ANNOUNCEMENT_PRIORITIES as readonly string[]).includes(value);
}

export function isAnnouncementCategory(value: string): value is AnnouncementCategory {
  return (ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(value);
}

export function isAnnouncementAudience(value: string): value is AnnouncementAudience {
  return (ANNOUNCEMENT_AUDIENCES as readonly string[]).includes(value);
}

export function isAllowedAnnouncementCtaHref(value: string): boolean {
  return (ANNOUNCEMENT_CTA_HREFS as readonly string[]).includes(value);
}
