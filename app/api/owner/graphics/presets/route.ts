import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import { ownerAuthFailureResponse, ownerJsonResponse, isOwnerAuthed } from "@/lib/owner/api-response";
import {
  cleanGraphicsMediaUrl,
  cleanGraphicsImageUrl,
  cleanGraphicsText,
  cleanGraphicsUuid,
  defaultGraphicsMetadataForKind,
  encodeGraphicsPresetMetadata,
  graphicsBuilderKindToPresetType,
  normalizeDurationSeconds,
  normalizeGraphicLayoutMode,
  normalizeGraphicPercent,
  normalizeGraphicPositionAnchor,
  normalizeGraphicsBuilderKind,
  normalizeGraphicZIndex,
  OWNER_GRAPHICS_EVENT_ID,
  type CreateGraphicsPresetPayload,
  type OwnerGraphicsPreset,
  type UpdateGraphicsPresetPayload,
} from "@/lib/owner/graphics-data-plane";

export const dynamic = "force-dynamic";

function isMissingGraphicsTable(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /owner_graphics_presets|does not exist|schema cache|42P01|PGRST205/i.test(message);
}

function buildPresetMutation(body: CreateGraphicsPresetPayload) {
  const builderKind = normalizeGraphicsBuilderKind(body.type);
  const contentPrimary = cleanGraphicsText(body.contentPrimary, 120);
  const secondaryText = cleanGraphicsText(body.contentSecondary, 260);
  const durationSeconds = normalizeDurationSeconds(body.durationSeconds);

  if (!builderKind || !contentPrimary) {
    return { error: "Choose a graphic type and primary text." };
  }

  const baseMetadata = defaultGraphicsMetadataForKind(builderKind);
  const metadata = {
    ...baseMetadata,
    builderKind,
    secondaryText: secondaryText || null,
    layoutMode: normalizeGraphicLayoutMode(body.layoutMode, builderKind),
    positionAnchor: normalizeGraphicPositionAnchor(body.positionAnchor),
    xPercent: normalizeGraphicPercent(body.xPercent, baseMetadata.xPercent),
    yPercent: normalizeGraphicPercent(body.yPercent, baseMetadata.yPercent),
    widthPercent: normalizeGraphicPercent(body.widthPercent, baseMetadata.widthPercent, 5, 100),
    heightPercent: normalizeGraphicPercent(body.heightPercent, baseMetadata.heightPercent, 5, 100),
    zIndex: normalizeGraphicZIndex(body.zIndex),
    mediaUrl: cleanGraphicsMediaUrl(body.mediaUrl),
    imageUrl: cleanGraphicsImageUrl(body.imageUrl),
  };

  if (builderKind === "SANCTUARY_VIDEO" && !metadata.mediaUrl) {
    return { error: "Add a sanctuary video URL before saving." };
  }

  return {
    value: {
      type: graphicsBuilderKindToPresetType(builderKind),
      content_primary: contentPrimary,
      content_secondary: encodeGraphicsPresetMetadata(metadata),
      duration_seconds: durationSeconds,
    },
  };
}

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("owner_graphics_presets")
      .select("*")
      .eq("event_id", OWNER_GRAPHICS_EVENT_ID)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingGraphicsTable(error.message)) {
        return ownerJsonResponse({ success: true, presets: [], warning: "Graphics presets table is not available." });
      }
      throw new Error(error.message);
    }

    return ownerJsonResponse({ success: true, presets: (data ?? []) as OwnerGraphicsPreset[] });
  } catch (error) {
    console.error("[owner/graphics/presets] GET failed:", error);
    return ownerJsonResponse({ success: false, error: "Unable to load graphics presets." }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const body = (await request.json()) as CreateGraphicsPresetPayload;
    const mutation = buildPresetMutation(body);
    if (mutation.error || !mutation.value) return ownerJsonResponse({ success: false, error: mutation.error }, 400);

    const { data, error } = await getSupabaseAdmin()
      .from("owner_graphics_presets")
      .insert({
        event_id: OWNER_GRAPHICS_EVENT_ID,
        ...mutation.value,
        is_active_on_stream: false,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return ownerJsonResponse({ success: true, preset: data as OwnerGraphicsPreset }, 201);
  } catch (error) {
    console.error("[owner/graphics/presets] POST failed:", error);
    return ownerJsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Unable to create graphic preset." },
      500,
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const body = (await request.json()) as UpdateGraphicsPresetPayload;
    const id = cleanGraphicsUuid(body.id);
    if (!id) {
      return ownerJsonResponse({ success: false, error: "Invalid graphic update." }, 400);
    }

    if (typeof body.isActiveOnStream === "boolean") {
      const { data, error } = await getSupabaseAdmin()
        .from("owner_graphics_presets")
        .update({ is_active_on_stream: body.isActiveOnStream })
        .eq("id", id)
        .eq("event_id", OWNER_GRAPHICS_EVENT_ID)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return ownerJsonResponse({ success: true, preset: data as OwnerGraphicsPreset });
    }

    const mutation = buildPresetMutation(body);
    if (mutation.error || !mutation.value) return ownerJsonResponse({ success: false, error: mutation.error }, 400);

    const { data, error } = await getSupabaseAdmin()
      .from("owner_graphics_presets")
      .update(mutation.value)
      .eq("id", id)
      .eq("event_id", OWNER_GRAPHICS_EVENT_ID)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return ownerJsonResponse({ success: true, preset: data as OwnerGraphicsPreset });
  } catch (error) {
    console.error("[owner/graphics/presets] PATCH failed:", error);
    return ownerJsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Unable to update graphic preset." },
      500,
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const body = (await request.json().catch(() => null)) as UpdateGraphicsPresetPayload | null;
    const id = cleanGraphicsUuid(body?.id);

    if (id) {
      const { data, error } = await getSupabaseAdmin()
        .from("owner_graphics_presets")
        .delete()
        .eq("id", id)
        .eq("event_id", OWNER_GRAPHICS_EVENT_ID)
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      return ownerJsonResponse({ success: true, deletedId: data.id });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("owner_graphics_presets")
      .update({ is_active_on_stream: false })
      .eq("event_id", OWNER_GRAPHICS_EVENT_ID)
      .eq("is_active_on_stream", true)
      .select("id");

    if (error) throw new Error(error.message);
    return ownerJsonResponse({ success: true, clearedCount: data?.length ?? 0 });
  } catch (error) {
    console.error("[owner/graphics/presets] DELETE failed:", error);
    return ownerJsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Unable to clear live graphics." },
      500,
    );
  }
}
