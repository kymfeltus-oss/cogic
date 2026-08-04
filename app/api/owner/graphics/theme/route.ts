import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import { ownerAuthFailureResponse, ownerJsonResponse, isOwnerAuthed } from "@/lib/owner/api-response";
import {
  normalizeBoundedInteger,
  normalizePlacementAnchor,
  OWNER_GRAPHICS_DEFAULT_THEME,
  OWNER_GRAPHICS_EVENT_ID,
  type OwnerGraphicsTheme,
  type UpdateGraphicsThemePayload,
} from "@/lib/owner/graphics-data-plane";

export const dynamic = "force-dynamic";

function isMissingThemeTable(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /owner_graphics_global_theme|does not exist|schema cache|42P01|PGRST205/i.test(message);
}

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("owner_graphics_global_theme")
      .select("*")
      .eq("event_id", OWNER_GRAPHICS_EVENT_ID)
      .maybeSingle();

    if (error) {
      if (isMissingThemeTable(error.message)) {
        return ownerJsonResponse({ success: true, theme: null, warning: "Graphics theme table is not available." });
      }
      throw new Error(error.message);
    }

    return ownerJsonResponse({ success: true, theme: (data ?? null) as OwnerGraphicsTheme | null });
  } catch (error) {
    console.error("[owner/graphics/theme] GET failed:", error);
    return ownerJsonResponse({ success: false, error: "Unable to load graphics theme." }, 500);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const body = (await request.json()) as UpdateGraphicsThemePayload;
    const customLogoUrl =
      typeof body.customLogoUrl === "string" && body.customLogoUrl.trim()
        ? body.customLogoUrl.trim().slice(0, 500)
        : null;

    const payload = {
      event_id: OWNER_GRAPHICS_EVENT_ID,
      corner_radius_px: normalizeBoundedInteger(
        body.cornerRadiusPx,
        OWNER_GRAPHICS_DEFAULT_THEME.corner_radius_px,
        0,
        64,
      ),
      padding_px: normalizeBoundedInteger(body.paddingPx, OWNER_GRAPHICS_DEFAULT_THEME.padding_px, 0, 96),
      background_opacity_percent: normalizeBoundedInteger(
        body.backgroundOpacityPercent,
        OWNER_GRAPHICS_DEFAULT_THEME.background_opacity_percent,
        0,
        100,
      ),
      placement_anchor: normalizePlacementAnchor(body.placementAnchor),
      custom_logo_url: customLogoUrl,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await getSupabaseAdmin()
      .from("owner_graphics_global_theme")
      .upsert(payload, { onConflict: "event_id" })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return ownerJsonResponse({ success: true, theme: data as OwnerGraphicsTheme });
  } catch (error) {
    console.error("[owner/graphics/theme] PATCH failed:", error);
    return ownerJsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Unable to update graphics theme." },
      500,
    );
  }
}
