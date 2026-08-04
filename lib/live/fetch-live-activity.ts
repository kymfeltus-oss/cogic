import type { SupabaseClient } from "@supabase/supabase-js";
import {
  displayNameFromEmail,
  type LiveActivityItem,
} from "@/lib/live/live-activity";

type DonationRow = {
  id: string;
  email: string;
  amount_cents: number;
  created_at: string;
};

type AcknowledgmentRow = {
  id: string;
  display_name: string;
  message: string;
  amount_total: number;
  product_type: string;
  created_at: string;
};

type ChatRow = {
  id: string;
  email: string;
  content: string;
  created_at: string;
};

function mapDonationRow(row: DonationRow): LiveActivityItem {
  const name = displayNameFromEmail(row.email);
  const amount = Math.round(row.amount_cents / 100);

  return {
    id: `donation-${row.id}`,
    kind: "donation",
    source: "real",
    name,
    message: `${name} sowed $${amount}`,
    amount,
    createdAt: row.created_at,
  };
}

function mapAcknowledgmentRow(row: AcknowledgmentRow): LiveActivityItem {
  const isGiving =
    row.product_type.includes("donation") ||
    row.product_type.includes("seed") ||
    row.message.toLowerCase().includes("harvest");

  return {
    id: `ack-${row.id}`,
    kind: isGiving ? "donation" : "join",
    source: "real",
    name: row.display_name,
    message: row.message,
    createdAt: row.created_at,
  };
}

function mapChatRow(row: ChatRow): LiveActivityItem {
  const name = displayNameFromEmail(row.email);

  return {
    id: `chat-${row.id}`,
    kind: "join",
    source: "real",
    name,
    message: row.content,
    createdAt: row.created_at,
  };
}

/**
 * Loads verified community activity from Supabase tables available to attendees.
 * Donation amounts are only included for paid donation records.
 */
export async function fetchRealLiveActivity(
  supabase: SupabaseClient,
): Promise<LiveActivityItem[]> {
  const [donationsResult, acknowledgmentsResult, chatResult] = await Promise.all([
    supabase
      .from("donations")
      .select("id, email, amount_cents, created_at")
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("live_acknowledgments")
      .select("id, display_name, message, amount_total, product_type, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("chat_messages")
      .select("id, email, content, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const items: LiveActivityItem[] = [];

  if (donationsResult.data) {
    for (const row of donationsResult.data as DonationRow[]) {
      items.push(mapDonationRow(row));
    }
  }

  if (acknowledgmentsResult.data) {
    for (const row of acknowledgmentsResult.data as AcknowledgmentRow[]) {
      const mapped = mapAcknowledgmentRow(row);
      if (mapped.kind === "donation") {
        items.push(mapped);
      } else {
        items.push(mapped);
      }
    }
  }

  if (chatResult.data) {
    for (const row of chatResult.data as ChatRow[]) {
      items.push(mapChatRow(row));
    }
  }

  const deduped = new Map<string, LiveActivityItem>();
  for (const item of items) {
    deduped.set(item.id, item);
  }

  return [...deduped.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
