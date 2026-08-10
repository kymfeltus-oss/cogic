import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  getGivingFundFrom,
  listActiveGivingFundsFrom,
  sortGivingFunds,
} from "@/lib/giving/funds";
import type { GivingFund } from "@/lib/giving/types";

type GivingFundRow = {
  id: string;
  fund_key: string;
  label: string;
  description: string | null;
  active: boolean;
  published: boolean;
  sort_order: number;
};

function mapRow(row: GivingFundRow): GivingFund {
  return {
    id: row.id,
    key: row.fund_key,
    label: row.label,
    description: row.description ?? row.label,
    active: row.active,
    published: row.published,
    sortOrder: row.sort_order,
  };
}

export async function listAllGivingFunds(): Promise<GivingFund[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("giving_funds")
    .select("id,fund_key,label,description,active,published,sort_order")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw new Error(`Unable to load giving funds: ${error.message}`);
  return sortGivingFunds(((data ?? []) as GivingFundRow[]).map(mapRow));
}

export async function listActiveGivingFunds(): Promise<GivingFund[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("giving_funds")
    .select("id,fund_key,label,description,active,published,sort_order")
    .eq("active", true)
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw new Error(`Unable to load active giving funds: ${error.message}`);
  return listActiveGivingFundsFrom(((data ?? []) as GivingFundRow[]).map(mapRow));
}

export async function getActiveGivingFund(key: string | null | undefined): Promise<GivingFund | null> {
  if (!key?.trim()) return null;
  const funds = await listActiveGivingFunds();
  return getGivingFundFrom(funds, key.trim());
}

export async function createGivingFund(input: {
  fundKey: string;
  label: string;
  description?: string | null;
  active?: boolean;
  published?: boolean;
  sortOrder?: number;
  actorUserId: string;
}): Promise<GivingFund> {
  const fundKey = input.fundKey.trim().toLowerCase();
  const label = input.label.trim();
  if (!/^[a-z][a-z0-9_]{1,47}$/.test(fundKey) || !label) {
    throw new Error("Valid fund key and label are required.");
  }
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("giving_funds")
    .insert({
      fund_key: fundKey,
      label,
      description: input.description?.trim() || label,
      active: input.active !== false,
      published: input.published !== false,
      sort_order: Number.isInteger(input.sortOrder) ? Number(input.sortOrder) : 0,
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })
    .select("id,fund_key,label,description,active,published,sort_order")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to create fund.");
  return mapRow(data as GivingFundRow);
}

export async function updateGivingFund(input: {
  id: string;
  label?: string;
  description?: string | null;
  active?: boolean;
  published?: boolean;
  sortOrder?: number;
  actorUserId: string;
}): Promise<GivingFund> {
  const patch: Record<string, unknown> = {
    updated_by: input.actorUserId,
    updated_at: new Date().toISOString(),
  };
  if (typeof input.label === "string") {
    const label = input.label.trim();
    if (!label) throw new Error("Label is required.");
    patch.label = label;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (typeof input.active === "boolean") patch.active = input.active;
  if (typeof input.published === "boolean") patch.published = input.published;
  if (input.sortOrder !== undefined) {
    if (!Number.isInteger(input.sortOrder)) throw new Error("Sort order must be an integer.");
    patch.sort_order = input.sortOrder;
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("giving_funds")
    .update(patch)
    .eq("id", input.id)
    .select("id,fund_key,label,description,active,published,sort_order")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Unable to update fund.");
  return mapRow(data as GivingFundRow);
}
