import { NextResponse } from "next/server";
import { parseAnnouncementWriteInput } from "@/lib/announcements/input";
import { mapAnnouncementRow, type AnnouncementRow } from "@/lib/announcements/map";
import { isAnnouncementStatus } from "@/lib/announcements/types";
import { DEFAULT_PROGRAM_KEY } from "@/lib/events/types";
import { sendAnnouncementPush } from "@/lib/push/announcement-push";
import { resendFailedDeliveries } from "@/lib/push/deliver";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SELECT =
  "id, program_key, title, summary, body, category, priority, status, audience, pinned, event_occurrence_id, cta_label, cta_href, scheduled_at, published_at, expires_at, created_at, updated_at";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Invalid announcement id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action =
    typeof body?.action === "string" ? body.action.trim().toLowerCase() : "update";

  const admin = getSupabaseAdmin();
  const { data: existing, error: loadError } = await admin
    .from("announcements")
    .select(SELECT)
    .eq("id", id)
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  const now = new Date().toISOString();

  if (action === "resend_push_failed") {
    const campaignKey = `announcement:${id}`;
    const resent = await resendFailedDeliveries(campaignKey);
    return NextResponse.json(
      {
        announcement: mapAnnouncementRow(existing as AnnouncementRow),
        pushResend: resent,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const patch: Record<string, unknown> = {
    updated_by: auth.userId,
    updated_at: now,
  };

  if (action === "publish") {
    patch.status = "published";
    patch.published_at = now;
  } else if (action === "unpublish") {
    patch.status = "draft";
    patch.published_at = null;
  } else if (action === "archive") {
    patch.status = "archived";
  } else if (action === "schedule") {
    const scheduledAt =
      typeof body?.scheduledAt === "string" ? Date.parse(body.scheduledAt) : NaN;
    if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
      return NextResponse.json(
        { error: "scheduledAt must be a future timestamp." },
        { status: 400 },
      );
    }
    patch.status = "scheduled";
    patch.scheduled_at = new Date(scheduledAt).toISOString();
    patch.published_at = null;
  } else if (action === "pin") {
    patch.pinned = true;
  } else if (action === "unpin") {
    patch.pinned = false;
  } else if (action === "update" || action === "draft") {
    let input;
    try {
      input = parseAnnouncementWriteInput(body);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid announcement." },
        { status: 400 },
      );
    }

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

    Object.assign(patch, {
      title: input.title,
      summary: input.summary,
      body: input.body,
      category: input.category,
      priority: input.priority,
      audience: input.audience,
      pinned: input.pinned,
      event_occurrence_id: input.eventOccurrenceId,
      cta_label: input.ctaLabel,
      cta_href: input.ctaHref,
      scheduled_at: input.scheduledAt,
      expires_at: input.expiresAt,
    });

    if (action === "draft") {
      patch.status = "draft";
      patch.published_at = null;
    } else if (
      typeof body?.status === "string" &&
      isAnnouncementStatus(body.status) &&
      ["draft", "scheduled", "published", "archived"].includes(body.status)
    ) {
      patch.status = body.status;
      if (body.status === "published" && !existing.published_at) {
        patch.published_at = now;
      }
      if (body.status === "draft" || body.status === "archived") {
        if (body.status === "draft") patch.published_at = null;
      }
    }
  } else {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("announcements")
    .update(patch)
    .eq("id", id)
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .select(SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Unable to update announcement." }, { status: 500 });
  }

  const sendPush = body?.sendPush === true;
  let pushResult = null;
  if (
    sendPush &&
    (action === "publish" || data.status === "published") &&
    data.status === "published"
  ) {
    pushResult = await sendAnnouncementPush({
      announcementId: data.id as string,
      title: data.title as string,
      summary: (data.summary as string | null) ?? null,
      body: data.body as string,
      priority: data.priority as string,
      audience: data.audience as string,
      createdBy: auth.userId,
    });
  }

  return NextResponse.json(
    {
      announcement: mapAnnouncementRow(data as AnnouncementRow),
      push: pushResult,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
