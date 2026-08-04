import { isValidHlsUrl, isValidHttpPlaybackUrl } from "@/lib/live/hls";

/** Public Mux test HLS (Big Buck Bunny) — opt-in dev fallback only. */
export const DEV_MANIFEST_FALLBACK_HLS =
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

const ENV_PLAYBACK_KEYS = [
  "ATTENDEE_PLAYBACK_HLS_URL",
  "NEXT_PUBLIC_HLS_STREAM_URL",
] as const;

let manifestEnvRoutingLogged = false;

/** Strip whitespace and accidental wrapping quotes from dotenv values. */
export function normalizeEnvPlaybackString(raw: string | undefined): string {
  let value = raw?.trim() ?? "";

  while (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value;
}

function logManifestEnvRoutingCheck(): void {
  if (manifestEnvRoutingLogged) return;
  manifestEnvRoutingLogged = true;

  const attendeeRaw = process.env.ATTENDEE_PLAYBACK_HLS_URL;
  const publicRaw = process.env.NEXT_PUBLIC_HLS_STREAM_URL;
  const attendee = normalizeEnvPlaybackString(attendeeRaw);
  const publicUrl = normalizeEnvPlaybackString(publicRaw);
  const resolved = resolveAttendeePlaybackFromEnv();

  console.log(
    "[Manifest Routing Cache Check]",
    attendee || publicUrl ? "FOUND ENV" : "ENV EMPTY",
    {
      attendeeDefined: Boolean(attendeeRaw?.trim()),
      publicDefined: Boolean(publicRaw?.trim()),
      attendeeNormalized: attendee || null,
      publicNormalized: publicUrl || null,
      resolvedPlaybackUrl: resolved,
      passesHlsValidation: resolved ? isValidHlsUrl(resolved) : false,
    },
  );
}

/** ATTENDEE_PLAYBACK_HLS_URL only — highest-priority env lane for production. */
export function resolvePrimaryAttendeePlaybackFromEnv(): string | null {
  const attendee = normalizeEnvPlaybackString(process.env.ATTENDEE_PLAYBACK_HLS_URL);
  if (attendee && isValidHlsUrl(attendee)) return attendee;
  return null;
}

/** Production HLS from env — ATTENDEE_PLAYBACK_HLS_URL first, then NEXT_PUBLIC_HLS_STREAM_URL. */
export function resolveAttendeePlaybackFromEnv(): string | null {
  logManifestEnvRoutingCheck();

  const configuredAttendee = resolveConfiguredAttendeePlaybackFromEnv();
  if (configuredAttendee) return configuredAttendee;

  const publicUrl = normalizeEnvPlaybackString(process.env.NEXT_PUBLIC_HLS_STREAM_URL);
  if (publicUrl && isValidHlsUrl(publicUrl)) return publicUrl;
  if (publicUrl && isValidHttpPlaybackUrl(publicUrl)) return publicUrl;

  return null;
}

export function hasAttendeePlaybackEnvConfigured(): boolean {
  return ENV_PLAYBACK_KEYS.some((key) => {
    const normalized = normalizeEnvPlaybackString(process.env[key]);
    return normalized.length > 0;
  });
}

export function isDemoManifestPlaybackUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return false;
  return trimmed.includes("test-streams.mux.dev") || trimmed === DEV_MANIFEST_FALLBACK_HLS;
}

export type ManifestExperienceKey =
  | "main_stage"
  | "crowd_xp"
  | "musician_xp"
  | "prayer_layer";

export type ManifestSuccessPayload = {
  success: true;
  playbackUrl: string;
  activeExperience: ManifestExperienceKey;
  activeSource: "primary" | "backup";
  /** Explicit false when serving configured production/env HLS (not Mux demo). */
  fallback?: boolean;
  fallbackReason?: string;
};

export function isAttendeePlaybackEnvPopulated(): boolean {
  return Boolean(normalizeEnvPlaybackString(process.env.ATTENDEE_PLAYBACK_HLS_URL));
}

/**
 * ATTENDEE_PLAYBACK_HLS_URL when set in .env — prefers valid .m3u8, accepts any http(s) URL.
 * Stops the manifest from falling through to the Mux demo when the operator configured env.
 */
export function resolveConfiguredAttendeePlaybackFromEnv(): string | null {
  const attendee = normalizeEnvPlaybackString(process.env.ATTENDEE_PLAYBACK_HLS_URL);
  if (!attendee) return null;
  return attendee;
}

/** True only when Mux demo fallback is explicitly allowed and no env playback is configured. */
export function isDevMuxManifestFallbackEnabled(): boolean {
  if (isAttendeePlaybackEnvPopulated()) return false;
  if (resolveConfiguredAttendeePlaybackFromEnv()) return false;
  if (resolveAttendeePlaybackFromEnv()) return false;
  return process.env.ENABLE_DEV_MANIFEST_FALLBACK?.trim() === "1";
}

export function isDevManifestFallbackEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Production env manifest — never flagged as demo fallback. */
export function buildProductionEnvManifestPayload(
  experience: ManifestExperienceKey,
): ManifestSuccessPayload | null {
  const playbackUrl = resolveAttendeePlaybackFromEnv();
  if (!playbackUrl) return null;

  console.warn(
    `[stream/manifest] Production env manifest → ${playbackUrl} [env override, fallback=false]`,
  );

  return {
    success: true,
    playbackUrl,
    activeExperience: experience,
    activeSource: "primary",
    fallback: false,
  };
}

export function buildDevManifestFallbackPayload(
  experience: ManifestExperienceKey,
  reason: string,
  options?: { suppressDemoFallback?: boolean },
): ManifestSuccessPayload | null {
  const productionPayload = buildProductionEnvManifestPayload(experience);
  if (productionPayload) {
    return productionPayload;
  }

  if (options?.suppressDemoFallback || !isDevMuxManifestFallbackEnabled()) {
    return null;
  }

  console.warn(
    `[stream/manifest] Manifest payload (${reason}) → ${DEV_MANIFEST_FALLBACK_HLS} [mux demo fallback]`,
  );

  return {
    success: true,
    playbackUrl: DEV_MANIFEST_FALLBACK_HLS,
    activeExperience: experience,
    activeSource: "primary",
    fallback: true,
    fallbackReason: reason,
  };
}
