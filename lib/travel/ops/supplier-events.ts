import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";

import type { SupplierChangeEventType } from "@/lib/travel/ops/supplier-webhook-parse";
export type { SupplierChangeEventType };

export async function recordSupplierChangeEvent(input: {
  providerKey: string;
  eventType: SupplierChangeEventType;
  providerEventId?: string | null;
  marketplaceAttemptId?: string | null;
  transactionId?: string | null;
  userId?: string | null;
  summary: string;
  payload?: Record<string, unknown>;
  applied?: boolean;
}) {
  const db = getSupabaseAdmin();
  const row = {
    program_key: TRAVEL_PROGRAM_KEY,
    provider_key: input.providerKey,
    event_type: input.eventType,
    provider_event_id: input.providerEventId || null,
    marketplace_attempt_id: input.marketplaceAttemptId || null,
    transaction_id: input.transactionId || null,
    user_id: input.userId || null,
    summary: input.summary.slice(0, 1000),
    payload: input.payload || {},
    applied: input.applied === true,
    applied_at: input.applied === true ? new Date().toISOString() : null,
  };

  if (input.providerEventId) {
    const existing = await db
      .from("travel_supplier_change_events")
      .select("*")
      .eq("provider_key", input.providerKey)
      .eq("provider_event_id", input.providerEventId)
      .maybeSingle();
    if (existing.data) {
      const { data, error } = await db
        .from("travel_supplier_change_events")
        .update({
          summary: row.summary,
          payload: row.payload,
          applied: row.applied,
          applied_at: row.applied_at,
          marketplace_attempt_id: row.marketplace_attempt_id,
          transaction_id: row.transaction_id,
          user_id: row.user_id,
        })
        .eq("id", existing.data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
  }

  const { data, error } = await db
    .from("travel_supplier_change_events")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listUserSupplierChangeEvents(userId: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("travel_supplier_change_events")
    .select("id,provider_key,event_type,summary,payload,applied,created_at,marketplace_attempt_id")
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}
