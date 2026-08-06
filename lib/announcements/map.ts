import type { Announcement } from "@/lib/announcements/types";

export type AnnouncementRow = {
  id: string;
  program_key: string;
  title: string;
  summary: string | null;
  body: string;
  category: string;
  priority: string;
  status: string;
  audience: string;
  pinned: boolean;
  event_occurrence_id: string | null;
  cta_label: string | null;
  cta_href: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapAnnouncementRow(
  row: AnnouncementRow,
  read = false,
): Announcement {
  return {
    id: row.id,
    programKey: row.program_key,
    title: row.title,
    summary: row.summary,
    body: row.body,
    category: row.category as Announcement["category"],
    priority: row.priority as Announcement["priority"],
    status: row.status as Announcement["status"],
    audience: row.audience as Announcement["audience"],
    pinned: row.pinned === true,
    eventOccurrenceId: row.event_occurrence_id,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    read,
  };
}
