import { NextResponse } from "next/server";
import { parseAnnouncementWriteInput } from "@/lib/announcements/input";
import { syncAnnouncementLifecycle } from "@/lib/announcements/lifecycle";
import { mapAnnouncementRow, type AnnouncementRow } from "@/lib/announcements/map";
import { sendAnnouncementPush } from "@/lib/push/announcement-push";
import { countEligiblePushDevices } from "@/lib/push/deliver";
import { isWebPushConfigured } from "@/lib/push/vapid";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { DEFAULT_PROGRAM_KEY } from "@/lib/events/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SELECT =
  "id, program_key, title, summary, body, category, priority, status, audience, pinned, event_occurrence_id, cta_label, cta_href, scheduled_at, published_at, expires_at, created_at, updated_at";

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  await syncAnnouncementLifecycle();
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("announcements")
    .select(SELECT)
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to load announcements." }, { status: 500 });
  }

  const rows = (data ?? []) as AnnouncementRow[];
  const ids = rows.map((row) => row.id);
  const readCounts = new Map<string, number>();

  if (ids.length > 0) {
    const { data: reads } = await admin
      .from("announcement_reads")
      .select("announcement_id")
      .in("announcement_id", ids);
    for (const read of reads ?? []) {
      const id = read.announcement_id as string;
      readCounts.set(id, (readCounts.get(id) ?? 0) + 1);
    }
  }

  let registeredTargetCount: number | null = null;
  const { count } = await admin
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .eq("status", "confirmed");
  if (typeof count === "number") registeredTargetCount = count;

  const pushConfigured = isWebPushConfigured();
  const pushDeliveryCounts = new Map<
    string,
    { sent: number; failed: number; expired: number; queued: number }
  >();
  if (ids.length > 0) {
    const { data: deliveries } = await admin
      .from("notification_deliveries")
      .select("announcement_id, status")
      .in("announcement_id", ids)
      .eq("kind", "announcement");
    for (const row of deliveries ?? []) {
      const id = row.announcement_id as string | null;
      if (!id) continue;
      const current = pushDeliveryCounts.get(id) ?? {
        sent: 0,
        failed: 0,
        expired: 0,
        queued: 0,
      };
      if (row.status === "sent") current.sent += 1;
      else if (row.status === "failed") current.failed += 1;
      else if (row.status === "expired") current.expired += 1;
      else current.queued += 1;
      pushDeliveryCounts.set(id, current);
    }
  }

  const eligibleDevices = pushConfigured
    ? await countEligiblePushDevices({
        kind: "announcement",
        audience: "all_authenticated",
      })
    : 0;

  return NextResponse.json(
    {
      announcements: rows.map((row) => {
        const announcement = mapAnnouncementRow(row);
        const readCount = readCounts.get(row.id) ?? 0;
        const targetedRecipients =
          row.audience === "registered_attendees" ? registeredTargetCount : null;
        return {
          ...announcement,
          readCount,
          targetedRecipients,
          unreadCount:
            targetedRecipients != null
              ? Math.max(targetedRecipients - readCount, 0)
              : null,
          readPercentage:
            targetedRecipients != null && targetedRecipients > 0
              ? Math.round((readCount / targetedRecipients) * 100)
              : null,
          pushDelivery: pushDeliveryCounts.get(row.id) ?? null,
        };
      }),
      channels: {
        inApp: true,
        email: false,
        push: pushConfigured,
        sms: false,
      },
      eligiblePushDevices: eligibleDevices,
      liveAutoAlertEnabled: pushConfigured,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  let input;
  try {
    input = parseAnnouncementWriteInput(body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid announcement." },
      { status: 400 },
    );
  }

  const action =
    typeof body?.action === "string" ? body.action.trim().toLowerCase() : "draft";
  if (!["draft", "schedule", "publish"].includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const now = new Date().toISOString();
  let status: "draft" | "scheduled" | "published" = "draft";
  let publishedAt: string | null = null;
  let scheduledAt = input.scheduledAt;

  if (action === "publish") {
    status = "published";
    publishedAt = now;
    if (scheduledAt && scheduledAt > now) {
      status = "scheduled";
      publishedAt = null;
    } else {
      scheduledAt = scheduledAt && scheduledAt <= now ? scheduledAt : null;
    }
  } else if (action === "schedule") {
    if (!scheduledAt || scheduledAt <= now) {
      return NextResponse.json(
        { error: "scheduledAt must be a future timestamp to schedule." },
        { status: 400 },
      );
    }
    status = "scheduled";
  }

  if (input.expiresAt && publishedAt && input.expiresAt <= publishedAt) {
    return NextResponse.json(
      { error: "expiresAt must be after publishedAt." },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();

  if (input.eventOccurrenceId) {
    const { data: occurrence } = await admin
      .from("event_occurrences")
      .select("id")
      .eq("id", input.eventOccurrenceId)
      .maybeSingle();
    if (!occurrence) {
      return NextResponse.json({ error: "Occurrence not found." }, { status: 404 });
    }
  }

  const { data, error } = await admin
    .from("announcements")
    .insert({
      program_key: DEFAULT_PROGRAM_KEY,
      title: input.title,
      summary: input.summary,
      body: input.body,
      category: input.category,
      priority: input.priority,
      status,
      audience: input.audience,
      pinned: input.pinned,
      event_occurrence_id: input.eventOccurrenceId,
      cta_label: input.ctaLabel,
      cta_href: input.ctaHref,
      scheduled_at: scheduledAt,
      published_at: publishedAt,
      expires_at: input.expiresAt,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select(SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Unable to create announcement." }, { status: 500 });
  }

  const sendPush = body?.sendPush === true;
  let pushResult = null;
  if (sendPush && status === "published") {
    pushResult = await sendAnnouncementPush({
      announcementId: data.id as string,
      title: input.title,
      summary: input.summary,
      body: input.body,
      priority: input.priority,
      audience: input.audience,
      createdBy: auth.userId,
    });
  }

  return NextResponse.json(
    {
      announcement: mapAnnouncementRow(data as AnnouncementRow),
      push: pushResult,
    },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}
