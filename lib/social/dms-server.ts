import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DM_MAX_BODY_LENGTH,
  DM_MAX_MEDIA_URLS,
  type DirectMessage,
  type DmConversationSummary,
} from "@/lib/social/dms-types";

export type { DirectMessage, DmConversationSummary } from "@/lib/social/dms-types";
export { DM_MAX_BODY_LENGTH, DM_MAX_MEDIA_URLS } from "@/lib/social/dms-types";

type DmRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_body: string;
  media_urls: string[] | null;
  read_at: string | null;
  created_at: string;
  deleted_by_sender_at: string | null;
  deleted_by_recipient_at: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

function mapMessage(row: DmRow): DirectMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.message_body,
    mediaUrls: Array.isArray(row.media_urls) ? row.media_urls : [],
    readAt: row.read_at,
    readStatus: row.read_at ? "read" : "unread",
    createdAt: row.created_at,
  };
}

export async function loadDmThread(
  admin: SupabaseClient,
  userId: string,
  peerUserId: string,
): Promise<DirectMessage[]> {
  const { data, error } = await admin
    .from("direct_messages")
    .select(
      "id, sender_id, recipient_id, message_body, media_urls, read_at, created_at, deleted_by_sender_at, deleted_by_recipient_at",
    )
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${peerUserId}),and(sender_id.eq.${peerUserId},recipient_id.eq.${userId})`,
    )
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) throw new Error(error.message);

  return ((data ?? []) as DmRow[])
    .filter((row) => {
      if (row.sender_id === userId && row.deleted_by_sender_at) return false;
      if (row.recipient_id === userId && row.deleted_by_recipient_at) return false;
      return true;
    })
    .map(mapMessage);
}

export async function loadDmInbox(
  admin: SupabaseClient,
  userId: string,
): Promise<DmConversationSummary[]> {
  const { data, error } = await admin
    .from("direct_messages")
    .select(
      "id, sender_id, recipient_id, message_body, media_urls, read_at, created_at, deleted_by_sender_at, deleted_by_recipient_at",
    )
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);

  const byPeer = new Map<string, DmConversationSummary>();
  for (const row of (data ?? []) as DmRow[]) {
    if (row.sender_id === userId && row.deleted_by_sender_at) continue;
    if (row.recipient_id === userId && row.deleted_by_recipient_at) continue;

    const peerUserId = row.sender_id === userId ? row.recipient_id : row.sender_id;
    const existing = byPeer.get(peerUserId);
    const unreadBump =
      row.recipient_id === userId && !row.read_at ? 1 : 0;

    if (!existing) {
      byPeer.set(peerUserId, {
        peerUserId,
        lastMessageId: row.id,
        lastBody: row.message_body,
        lastCreatedAt: row.created_at,
        unreadCount: unreadBump,
      });
      continue;
    }

    existing.unreadCount += unreadBump;
  }

  return [...byPeer.values()].sort((a, b) =>
    a.lastCreatedAt < b.lastCreatedAt ? 1 : -1,
  );
}

export async function sendDirectMessage(
  admin: SupabaseClient,
  input: {
    senderId: string;
    recipientId: string;
    body: string;
    mediaUrls?: string[];
  },
): Promise<DirectMessage> {
  const body = input.body.trim();
  if (body.length < 1 || body.length > DM_MAX_BODY_LENGTH) {
    throw new Error(`Message must be between 1 and ${DM_MAX_BODY_LENGTH} characters.`);
  }
  if (!isUuid(input.recipientId)) {
    throw new Error("A valid recipient is required.");
  }
  if (input.recipientId === input.senderId) {
    throw new Error("You cannot message yourself.");
  }

  const mediaUrls = (input.mediaUrls ?? [])
    .map((url) => String(url || "").trim())
    .filter(Boolean);
  if (mediaUrls.length > DM_MAX_MEDIA_URLS) {
    throw new Error(`Maximum of ${DM_MAX_MEDIA_URLS} media attachments allowed.`);
  }
  if (mediaUrls.some((url) => !/^https:\/\//i.test(url))) {
    throw new Error("Media URLs must use HTTPS.");
  }

  const { data, error } = await admin
    .from("direct_messages")
    .insert({
      sender_id: input.senderId,
      recipient_id: input.recipientId,
      message_body: body,
      media_urls: mediaUrls,
    })
    .select(
      "id, sender_id, recipient_id, message_body, media_urls, read_at, created_at, deleted_by_sender_at, deleted_by_recipient_at",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to send message.");
  }
  return mapMessage(data as DmRow);
}

export async function markDmThreadRead(
  admin: SupabaseClient,
  userId: string,
  peerUserId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("direct_messages")
    .update({ read_at: now, updated_at: now })
    .eq("recipient_id", userId)
    .eq("sender_id", peerUserId)
    .is("read_at", null);

  if (error) throw new Error(error.message);
}
