import {
  DEFAULT_COUNTDOWN_CONFIG,
  DEFAULT_EVENT_ID,
  validateCountdownConfigInput,
  type EventCountdownConfig,
} from "@/lib/live/countdown-config";
import { loadAdminCountdownConfig, saveCountdownConfig } from "@/lib/live/fetch-countdown-config";
import { resolveExternalIngestCredentials } from "@/lib/owner/resolve-external-ingest-credentials";
import { resolveIvsIngestCredentials } from "@/lib/owner/resolve-ivs-config";
import { loadOwnerStreamState, updateOwnerStreamState } from "@/lib/owner/load-owner-state";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type LowerThirdTheme = "NEON_PURPLE_SLIDE" | "MINIMAL_GLASS_FADE" | "CYAN_GLOW";

export type LowerThirdAsset = {
  id: string;
  primaryText: string;
  secondaryText: string;
  theme: LowerThirdTheme;
};

export type ProgramSegment = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
};

export type AccessTier = "PAYWALL" | "FREE_REGISTRATION" | "PUBLIC";

export type ShowSetupState = {
  showTitle: string;
  presenterName: string;
  hostNames: string[];
  eventLocation: string;
  livestreamAvailability: string;
  targetDateTime: string;
  gateControl: "LOCKED" | "EARLY_ACCESS";
  primaryIngestEndpoint: string;
  streamKey: string;
  fallbackAssetPath: string;
  lowerThirds: LowerThirdAsset[];
  programFlow: ProgramSegment[];
  monetizationEnabled: boolean;
  gateType: AccessTier;
  accessTiers: AccessTier[];
  ticketPricingGA: number;
  ticketPricingVIP: number;
  chatEnabled: boolean;
  chatSlowMode: boolean;
  dvrBufferEnabled: boolean;
  verboseTelemetry: boolean;
  restreamDestinations: {
    twitch: boolean;
    youtube: boolean;
    facebook: boolean;
  };
  updatedAt: string | null;
  updatedBy: string | null;
};

const SETUP_KEY = "show_setup";

const DEFAULT_LOWER_THIRDS: LowerThirdAsset[] = [
  {
    id: "1",
    primaryText: "SARAH JENKINS",
    secondaryText: "Audio Engineer",
    theme: "NEON_PURPLE_SLIDE",
  },
];

const DEFAULT_PROGRAM_FLOW: ProgramSegment[] = [
  { id: "1", title: "Opening Countdown", description: "Inter description", durationMinutes: 5 },
  { id: "2", title: "Host Welcome", description: "Inter description", durationMinutes: 10 },
  { id: "3", title: "Band Set 1", description: "Inter description", durationMinutes: 25 },
  { id: "4", title: "Keynote Presentation", description: "Inter description", durationMinutes: 30 },
  { id: "5", title: "Q&A Session", description: "Inter description", durationMinutes: 15 },
];

const DEFAULT_RESTREAM_DESTINATIONS: ShowSetupState["restreamDestinations"] = {
  twitch: true,
  youtube: true,
  facebook: true,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanText(value: unknown, fallback: string, limit = 120): string {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/<[^>]*>/g, "").slice(0, limit)
    : fallback;
}

function cleanBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function cleanHostNames(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((host) => cleanText(host, "", 80))
    .filter(Boolean)
    .slice(0, 8);
}

function cleanNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function cleanTheme(value: unknown): LowerThirdTheme {
  if (
    value === "NEON_PURPLE_SLIDE" ||
    value === "MINIMAL_GLASS_FADE" ||
    value === "CYAN_GLOW"
  ) {
    return value;
  }
  return "NEON_PURPLE_SLIDE";
}

function cleanLowerThirds(value: unknown): LowerThirdAsset[] {
  if (!Array.isArray(value)) return DEFAULT_LOWER_THIRDS;
  const cleaned = value.slice(0, 12).map((item, index) => {
    const record = asRecord(item);
    return {
      id: cleanText(record.id, String(index + 1), 32),
      primaryText: cleanText(record.primaryText, "NEW SPEAKER", 80),
      secondaryText: cleanText(record.secondaryText, "Role", 80),
      theme: cleanTheme(record.theme),
    };
  });
  return cleaned.length ? cleaned : DEFAULT_LOWER_THIRDS;
}

function cleanProgramFlow(value: unknown): ProgramSegment[] {
  if (!Array.isArray(value)) return DEFAULT_PROGRAM_FLOW;
  const cleaned = value.slice(0, 24).map((item, index) => {
    const record = asRecord(item);
    return {
      id: cleanText(record.id, String(index + 1), 32),
      title: cleanText(record.title, "Program Segment", 80),
      description: cleanText(record.description, "Inter description", 120),
      durationMinutes: Math.max(1, Math.min(240, Math.trunc(cleanNumber(record.durationMinutes, 5)))),
    };
  });
  return cleaned.length ? cleaned : DEFAULT_PROGRAM_FLOW;
}

function cleanGateType(value: unknown, fallback: AccessTier): AccessTier {
  if (value === "PAYWALL" || value === "FREE_REGISTRATION" || value === "PUBLIC") return value;
  return fallback;
}

function cleanAccessTiers(value: unknown, fallback: AccessTier[]): AccessTier[] {
  if (!Array.isArray(value)) return fallback;
  const tiers = value.filter(
    (tier): tier is AccessTier =>
      tier === "PAYWALL" || tier === "FREE_REGISTRATION" || tier === "PUBLIC",
  );
  return Array.from(new Set(tiers)).slice(0, 3);
}

function cleanTargetDateTime(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function buildEndTime(startIso: string, programFlow: ProgramSegment[]): string {
  const start = new Date(startIso);
  const duration = programFlow.reduce((sum, segment) => sum + segment.durationMinutes, 0);
  start.setMinutes(start.getMinutes() + Math.max(duration, 30));
  return start.toISOString();
}

function mergeStoredSetup(
  base: ShowSetupState,
  stored: Record<string, unknown>,
): ShowSetupState {
  const restream = asRecord(stored.restreamDestinations);
  const baseRestream = base.restreamDestinations ?? DEFAULT_RESTREAM_DESTINATIONS;
  const gateType = cleanGateType(stored.gateType, base.gateType);
  const accessTiersFallback =
    "gateType" in stored ? [gateType] : base.accessTiers.length ? base.accessTiers : [gateType];
  return {
    ...base,
    hostNames: cleanHostNames(stored.hostNames, base.hostNames),
    eventLocation: cleanText(stored.eventLocation, base.eventLocation, 100),
    livestreamAvailability: cleanText(
      stored.livestreamAvailability,
      base.livestreamAvailability,
      100,
    ),
    fallbackAssetPath: cleanText(stored.fallbackAssetPath, base.fallbackAssetPath, 200),
    lowerThirds: cleanLowerThirds(stored.lowerThirds),
    programFlow: cleanProgramFlow(stored.programFlow),
    monetizationEnabled: cleanBool(stored.monetizationEnabled, base.monetizationEnabled),
    gateType,
    accessTiers: Array.isArray(stored.accessTiers)
      ? cleanAccessTiers(stored.accessTiers, accessTiersFallback)
      : accessTiersFallback,
    ticketPricingGA: cleanNumber(stored.ticketPricingGA, base.ticketPricingGA),
    ticketPricingVIP: cleanNumber(stored.ticketPricingVIP, base.ticketPricingVIP),
    chatEnabled: cleanBool(stored.chatEnabled, base.chatEnabled),
    chatSlowMode: cleanBool(stored.chatSlowMode, base.chatSlowMode),
    dvrBufferEnabled: cleanBool(stored.dvrBufferEnabled, base.dvrBufferEnabled),
    verboseTelemetry: cleanBool(stored.verboseTelemetry, base.verboseTelemetry),
    restreamDestinations: {
      twitch: cleanBool(restream.twitch, baseRestream.twitch),
      youtube: cleanBool(restream.youtube, baseRestream.youtube),
      facebook: cleanBool(restream.facebook, baseRestream.facebook),
    },
  };
}

export async function loadShowSetupState(): Promise<ShowSetupState> {
  const admin = getSupabaseAdmin();
  const [{ row }, countdownConfig] = await Promise.all([
    loadOwnerStreamState(admin),
    loadAdminCountdownConfig(),
  ]);
  const primary = resolveExternalIngestCredentials();
  const backup = resolveIvsIngestCredentials();
  const base: ShowSetupState = {
    showTitle: row?.concert_title ?? "COGIC LIVE",
    presenterName: row?.headliner_name ?? "COGIC LIVE",
    hostNames: [],
    eventLocation: "New Orleans, LA",
    livestreamAvailability: "Available worldwide",
    targetDateTime: countdownConfig.start_time,
    gateControl: "EARLY_ACCESS",
    primaryIngestEndpoint: primary.rtmpUrl ?? backup.ingestServer ?? "",
    streamKey: primary.streamKey ?? backup.streamKey ?? "",
    fallbackAssetPath: "",
    lowerThirds: DEFAULT_LOWER_THIRDS,
    programFlow: DEFAULT_PROGRAM_FLOW,
    monetizationEnabled: true,
    gateType: "PAYWALL",
    accessTiers: ["PAYWALL"],
    ticketPricingGA: 49.99,
    ticketPricingVIP: 99.99,
    chatEnabled: true,
    chatSlowMode: true,
    dvrBufferEnabled: true,
    verboseTelemetry: false,
    restreamDestinations: DEFAULT_RESTREAM_DESTINATIONS,
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  };

  const storedPresets = asRecord(row?.audio_master_presets);
  const storedSetup = asRecord(storedPresets[SETUP_KEY]);

  return mergeStoredSetup(base, storedSetup);
}

export async function saveShowSetupState(
  input: Record<string, unknown>,
  updatedBy: string,
): Promise<ShowSetupState> {
  const current = await loadShowSetupState();
  const next = mergeStoredSetup(
    {
      ...current,
      showTitle: cleanText(input.showTitle, current.showTitle),
      presenterName: cleanText(input.presenterName, current.presenterName),
      eventLocation: cleanText(input.eventLocation, current.eventLocation, 100),
      livestreamAvailability: cleanText(
        input.livestreamAvailability,
        current.livestreamAvailability,
        100,
      ),
      targetDateTime: cleanTargetDateTime(input.targetDateTime, current.targetDateTime),
      gateControl: input.gateControl === "LOCKED" ? "LOCKED" : "EARLY_ACCESS",
    },
    input,
  );

  const countdownInput = {
    ...DEFAULT_COUNTDOWN_CONFIG,
    event_id: DEFAULT_EVENT_ID,
    headline: next.showTitle,
    eyebrow: "LIVE RECORDING EXPERIENCE",
    subtitle: next.presenterName,
    start_time: next.targetDateTime,
    end_time: buildEndTime(next.targetDateTime, next.programFlow),
    is_active: true,
  };
  const validation = validateCountdownConfigInput(countdownInput);
  if (validation.ok === false) throw new Error(validation.error);

  const admin = getSupabaseAdmin();
  const { row } = await loadOwnerStreamState(admin);
  const existingPresets = asRecord(row?.audio_master_presets);
  const setupPayload = {
    hostNames: next.hostNames,
    eventLocation: next.eventLocation,
    livestreamAvailability: next.livestreamAvailability,
    fallbackAssetPath: next.fallbackAssetPath,
    lowerThirds: next.lowerThirds,
    programFlow: next.programFlow,
    monetizationEnabled: next.monetizationEnabled,
    gateType: next.gateType,
    accessTiers: next.accessTiers,
    ticketPricingGA: next.ticketPricingGA,
    ticketPricingVIP: next.ticketPricingVIP,
    chatEnabled: next.chatEnabled,
    chatSlowMode: next.chatSlowMode,
    dvrBufferEnabled: next.dvrBufferEnabled,
    verboseTelemetry: next.verboseTelemetry,
    restreamDestinations: next.restreamDestinations,
  };

  await saveCountdownConfig(validation.config as EventCountdownConfig);
  const { error } = await updateOwnerStreamState(admin, {
    current_state: "scheduled",
    concert_title: next.showTitle,
    headliner_name: next.presenterName,
    audio_master_presets: {
      ...existingPresets,
      [SETUP_KEY]: setupPayload,
    },
    updated_by: updatedBy,
  });

  if (error) throw new Error(error);
  return loadShowSetupState();
}
