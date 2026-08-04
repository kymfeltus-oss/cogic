export const OWNER_GRAPHICS_EVENT_ID = "300-awakening";

export const OWNER_GRAPHICS_DEFAULT_THEME = {
  event_id: OWNER_GRAPHICS_EVENT_ID,
  corner_radius_px: 8,
  padding_px: 24,
  background_opacity_percent: 80,
  placement_anchor: "BOTTOM_LEFT" as GraphicsPlacementAnchor,
  custom_logo_url: null as string | null,
};

export const GRAPHICS_PRESET_TYPES = [
  "LOWER_THIRD",
  "OFFERING",
  "SCRIPTURE",
  "SLATE",
  "TICKER",
] as const;

export type GraphicsPresetType = (typeof GRAPHICS_PRESET_TYPES)[number];

export type GraphicsPlacementAnchor =
  | "TOP_LEFT"
  | "TOP_RIGHT"
  | "BOTTOM_LEFT"
  | "BOTTOM_RIGHT"
  | "CENTER";

export type GraphicsBuilderKind = GraphicsPresetType | "SANCTUARY_VIDEO";

export type GraphicLayoutMode =
  | "lower_third"
  | "fullscreen"
  | "partial"
  | "ticker"
  | "corner_bug"
  | "sanctuary_video";

export type GraphicPositionAnchor = GraphicsPlacementAnchor | "FULLSCREEN";

export type OwnerGraphicsPresetMetadata = {
  secondaryText: string | null;
  builderKind: GraphicsBuilderKind;
  layoutMode: GraphicLayoutMode;
  positionAnchor: GraphicPositionAnchor;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  zIndex: number;
  mediaUrl: string | null;
  imageUrl: string | null;
};

export type OwnerGraphicsPreset = {
  id: string;
  event_id: string;
  type: GraphicsPresetType;
  content_primary: string;
  content_secondary: string | null;
  is_active_on_stream: boolean;
  duration_seconds: number;
  created_at: string;
};

export type OwnerGraphicsTheme = {
  id: string;
  event_id: string;
  corner_radius_px: number;
  padding_px: number;
  background_opacity_percent: number;
  placement_anchor: GraphicsPlacementAnchor;
  custom_logo_url: string | null;
  updated_at: string;
};

export type CreateGraphicsPresetPayload = {
  type?: unknown;
  contentPrimary?: unknown;
  contentSecondary?: unknown;
  durationSeconds?: unknown;
  layoutMode?: unknown;
  positionAnchor?: unknown;
  xPercent?: unknown;
  yPercent?: unknown;
  widthPercent?: unknown;
  heightPercent?: unknown;
  zIndex?: unknown;
  mediaUrl?: unknown;
  imageUrl?: unknown;
};

export type UpdateGraphicsPresetPayload = {
  id?: unknown;
  isActiveOnStream?: unknown;
  type?: unknown;
  contentPrimary?: unknown;
  contentSecondary?: unknown;
  durationSeconds?: unknown;
  layoutMode?: unknown;
  positionAnchor?: unknown;
  xPercent?: unknown;
  yPercent?: unknown;
  widthPercent?: unknown;
  heightPercent?: unknown;
  zIndex?: unknown;
  mediaUrl?: unknown;
  imageUrl?: unknown;
};

export type UpdateGraphicsThemePayload = {
  action?: unknown;
  cornerRadiusPx?: unknown;
  paddingPx?: unknown;
  backgroundOpacityPercent?: unknown;
  placementAnchor?: unknown;
  customLogoUrl?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const GRAPHICS_METADATA_KEY = "__ownerGraphicsMeta";

export const DEFAULT_GRAPHICS_PRESET_METADATA: OwnerGraphicsPresetMetadata = {
  secondaryText: null,
  builderKind: "LOWER_THIRD",
  layoutMode: "lower_third",
  positionAnchor: "BOTTOM_LEFT",
  xPercent: 6,
  yPercent: 72,
  widthPercent: 54,
  heightPercent: 20,
  zIndex: 10,
  mediaUrl: null,
  imageUrl: "/assets/logos/300-awakening-logo.png",
};

export function cleanGraphicsUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

export function cleanGraphicsText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizeGraphicsPresetType(value: unknown): GraphicsPresetType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  return GRAPHICS_PRESET_TYPES.includes(normalized as GraphicsPresetType)
    ? (normalized as GraphicsPresetType)
    : null;
}

export function normalizeGraphicsBuilderKind(value: unknown): GraphicsBuilderKind | null {
  if (value === "SANCTUARY_VIDEO") return value;
  return normalizeGraphicsPresetType(value);
}

export function graphicsBuilderKindToPresetType(kind: GraphicsBuilderKind): GraphicsPresetType {
  return kind === "SANCTUARY_VIDEO" ? "SLATE" : kind;
}

export function normalizeDurationSeconds(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : 0;

  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(3600, Math.trunc(parsed)));
}

export function normalizeBoundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : fallback;

  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export function normalizePlacementAnchor(value: unknown): GraphicsPlacementAnchor {
  if (
    value === "TOP_LEFT" ||
    value === "TOP_RIGHT" ||
    value === "BOTTOM_LEFT" ||
    value === "BOTTOM_RIGHT" ||
    value === "CENTER"
  ) {
    return value;
  }

  return OWNER_GRAPHICS_DEFAULT_THEME.placement_anchor;
}

export function normalizeGraphicPositionAnchor(value: unknown): GraphicPositionAnchor {
  if (value === "FULLSCREEN") return value;
  return normalizePlacementAnchor(value);
}

export function normalizeGraphicLayoutMode(value: unknown, builderKind: GraphicsBuilderKind): GraphicLayoutMode {
  if (
    value === "lower_third" ||
    value === "fullscreen" ||
    value === "partial" ||
    value === "ticker" ||
    value === "corner_bug" ||
    value === "sanctuary_video"
  ) {
    return value;
  }

  if (builderKind === "SANCTUARY_VIDEO") return "sanctuary_video";
  if (builderKind === "TICKER") return "ticker";
  if (builderKind === "SLATE") return "fullscreen";
  return "lower_third";
}

export function normalizeGraphicPercent(value: unknown, fallback: number, min = 0, max = 100): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed * 10) / 10));
}

export function normalizeGraphicZIndex(value: unknown): number {
  return normalizeBoundedInteger(value, DEFAULT_GRAPHICS_PRESET_METADATA.zIndex, 0, 99);
}

export function cleanGraphicsMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 800) return null;

  if (trimmed.startsWith("/")) {
    return trimmed.includes("..") ? null : trimmed;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const cleanGraphicsImageUrl = cleanGraphicsMediaUrl;

export function defaultGraphicsMetadataForKind(kind: GraphicsBuilderKind): OwnerGraphicsPresetMetadata {
  if (kind === "SANCTUARY_VIDEO") {
    return {
      ...DEFAULT_GRAPHICS_PRESET_METADATA,
      builderKind: kind,
      layoutMode: "sanctuary_video",
      positionAnchor: "FULLSCREEN",
      xPercent: 0,
      yPercent: 0,
      widthPercent: 100,
      heightPercent: 100,
      zIndex: 2,
    };
  }

  if (kind === "SLATE") {
    return {
      ...DEFAULT_GRAPHICS_PRESET_METADATA,
      builderKind: kind,
      layoutMode: "fullscreen",
      positionAnchor: "FULLSCREEN",
      xPercent: 0,
      yPercent: 0,
      widthPercent: 100,
      heightPercent: 100,
      zIndex: 4,
    };
  }

  if (kind === "TICKER") {
    return {
      ...DEFAULT_GRAPHICS_PRESET_METADATA,
      builderKind: kind,
      layoutMode: "ticker",
      positionAnchor: "BOTTOM_LEFT",
      xPercent: 4,
      yPercent: 86,
      widthPercent: 92,
      heightPercent: 9,
      zIndex: 20,
    };
  }

  return {
    ...DEFAULT_GRAPHICS_PRESET_METADATA,
    builderKind: kind,
    layoutMode: "lower_third",
  };
}

export function encodeGraphicsPresetMetadata(metadata: OwnerGraphicsPresetMetadata): string {
  return JSON.stringify({
    [GRAPHICS_METADATA_KEY]: 1,
    ...metadata,
  });
}

export function decodeGraphicsPresetMetadata(
  preset: Pick<OwnerGraphicsPreset, "type" | "content_secondary">,
): OwnerGraphicsPresetMetadata {
  const fallback = {
    ...defaultGraphicsMetadataForKind(preset.type),
    secondaryText: preset.content_secondary || null,
  };

  if (!preset.content_secondary?.trim().startsWith("{")) return fallback;

  try {
    const parsed = JSON.parse(preset.content_secondary) as Partial<OwnerGraphicsPresetMetadata> & Record<string, unknown>;
    if (parsed[GRAPHICS_METADATA_KEY] !== 1) return fallback;

    const builderKind = normalizeGraphicsBuilderKind(parsed.builderKind) ?? preset.type;
    const base = defaultGraphicsMetadataForKind(builderKind);
    return {
      ...base,
      secondaryText:
        typeof parsed.secondaryText === "string" && parsed.secondaryText.trim()
          ? cleanGraphicsText(parsed.secondaryText, 260)
          : null,
      layoutMode: normalizeGraphicLayoutMode(parsed.layoutMode, builderKind),
      positionAnchor: normalizeGraphicPositionAnchor(parsed.positionAnchor),
      xPercent: normalizeGraphicPercent(parsed.xPercent, base.xPercent),
      yPercent: normalizeGraphicPercent(parsed.yPercent, base.yPercent),
      widthPercent: normalizeGraphicPercent(parsed.widthPercent, base.widthPercent, 5, 100),
      heightPercent: normalizeGraphicPercent(parsed.heightPercent, base.heightPercent, 5, 100),
      zIndex: normalizeGraphicZIndex(parsed.zIndex),
      mediaUrl: cleanGraphicsMediaUrl(parsed.mediaUrl),
      imageUrl: cleanGraphicsImageUrl(parsed.imageUrl),
      builderKind,
    };
  } catch {
    return fallback;
  }
}

export function formatGraphicsTypeLabel(type: GraphicsPresetType): string {
  return type
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function getGraphicsTypeHelp(type: GraphicsPresetType): {
  primary: string;
  secondary: string;
  placeholderPrimary: string;
  placeholderSecondary: string;
} {
  switch (type) {
    case "LOWER_THIRD":
      return {
        primary: "Main Text",
        secondary: "Subtitle / Role",
        placeholderPrimary: "PASTOR IAN CRAIG",
        placeholderSecondary: "LEAD PASTOR",
      };
    case "OFFERING":
      return {
        primary: "Offering Callout",
        secondary: "Giving Details",
        placeholderPrimary: "WAYS TO GIVE",
        placeholderSecondary: 'TEXT "300" TO 77977',
      };
    case "SCRIPTURE":
      return {
        primary: "Scripture Reference",
        secondary: "Scripture Text",
        placeholderPrimary: "JOHN 3:16",
        placeholderSecondary: "For God so loved the world...",
      };
    case "SLATE":
      return {
        primary: "Slate Headline",
        secondary: "Slate Support Copy",
        placeholderPrimary: "STARTING SOON",
        placeholderSecondary: "Service begins in moments",
      };
    case "TICKER":
      return {
        primary: "Ticker Lead",
        secondary: "Ticker Sequence",
        placeholderPrimary: "WELCOME TO 300 AWAKENING",
        placeholderSecondary: "FOLLOW US @300AWAKENING",
      };
  }
}
