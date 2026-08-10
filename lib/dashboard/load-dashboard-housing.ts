import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DEFAULT_PROGRAM_KEY } from "@/lib/registration/types";
import { summarizeHousing, type DashboardHousingSummary } from "@/lib/dashboard/dashboard-module-summaries";

export async function loadDashboardHousingSummary(
  userId: string | null,
): Promise<DashboardHousingSummary> {
  if (!userId) {
    return {
      available: true,
      error: null,
      preference: null,
      status: null,
      hotelName: null,
      blockName: null,
      arrival: null,
      departure: null,
      summary: "Sign in to view your housing preferences.",
      cta: "Sign in",
    };
  }

  try {
    const db = getSupabaseAdmin();
    const { data: group, error: groupError } = await db
      .from("registration_groups")
      .select("id")
      .eq("owner_user_id", userId)
      .eq("program_key", DEFAULT_PROGRAM_KEY)
      .maybeSingle();

    if (groupError) throw groupError;
    if (!group?.id) return summarizeHousing({});

    const { data: request, error: requestError } = await db
      .from("housing_requests")
      .select(
        "preference,status,arrival_date,departure_date,housing_hotels(name),housing_blocks(name)",
      )
      .eq("registration_group_id", group.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (requestError) throw requestError;
    if (!request) return summarizeHousing({});

    const hotel = Array.isArray(request.housing_hotels)
      ? request.housing_hotels[0]
      : request.housing_hotels;
    const block = Array.isArray(request.housing_blocks)
      ? request.housing_blocks[0]
      : request.housing_blocks;

    return summarizeHousing({
      preference: request.preference ?? null,
      status: request.status ?? null,
      hotelName: hotel?.name ?? null,
      blockName: block?.name ?? null,
      arrival: request.arrival_date ?? null,
      departure: request.departure_date ?? null,
    });
  } catch {
    return summarizeHousing({ error: "Unable to load housing." });
  }
}
