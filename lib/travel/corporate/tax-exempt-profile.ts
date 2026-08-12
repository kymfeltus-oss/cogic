import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ChurchTaxProfileRow } from "@/lib/travel/corporate/tax-exempt-review";

/**
 * Structured empty-state when a church has no church_tax_profiles row yet.
 * Returned instead of throwing on missing data (never use .single() for this lookup).
 */
export type ChurchTaxProfileFallback = {
  verification_status: "pending_upload";
  legal_name: "";
  ein: "";
  is_fallback_initialization: true;
};

export type ChurchTaxProfileLookupResult =
  | (ChurchTaxProfileRow & { is_fallback_initialization?: false })
  | ChurchTaxProfileFallback;

export function isChurchTaxProfileFallback(
  value: ChurchTaxProfileLookupResult,
): value is ChurchTaxProfileFallback {
  return value.is_fallback_initialization === true;
}

/**
 * Load tax profile for a church.
 * Uses .maybeSingle() so unseeded churches return a pending_upload fallback
 * instead of crashing with PGRST116 from .single().
 */
export async function getChurchTaxProfile(
  churchId: string,
): Promise<ChurchTaxProfileLookupResult> {
  return loadTaxProfileForChurch(churchId);
}

/** Alias used by status / upload orchestration. */
export async function loadTaxProfileForChurch(
  churchId: string,
): Promise<ChurchTaxProfileLookupResult> {
  const { data, error } = await getSupabaseAdmin()
    .from("church_tax_profiles")
    .select("*")
    .eq("church_id", churchId)
    .maybeSingle();

  if (error) {
    // Empty-result codes from a .single() regression must not become 500s.
    if (error.code === "PGRST116") {
      return {
        verification_status: "pending_upload",
        legal_name: "",
        ein: "",
        is_fallback_initialization: true,
      };
    }
    console.error("[tax-exempt-engine] Query exception:", {
      message: error.message,
      code: error.code,
    });
    throw error;
  }

  if (!data) {
    return {
      verification_status: "pending_upload",
      legal_name: "",
      ein: "",
      is_fallback_initialization: true,
    };
  }

  return {
    ...(data as ChurchTaxProfileRow),
    is_fallback_initialization: false,
  };
}
