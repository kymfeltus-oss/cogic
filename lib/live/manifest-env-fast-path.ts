import type { NextRequest } from "next/server";
import {
  buildDevManifestFallbackPayload,
  buildProductionEnvManifestPayload,
  isAttendeePlaybackEnvPopulated,
  isDevManifestFallbackEnabled,
  resolveConfiguredAttendeePlaybackFromEnv,
  resolveAttendeePlaybackFromEnv,
  type ManifestExperienceKey,
  type ManifestSuccessPayload,
} from "@/lib/live/manifest-dev-fallback";

/** Resolve attendee HLS URL from process env (no I/O). */
export function resolveEnvPlaybackUrl(): string | null {
  return resolveAttendeePlaybackFromEnv();
}

const LOCALHOST_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function resolveManifestCorsOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (origin && LOCALHOST_ORIGIN.test(origin)) return origin;
  return "http://localhost:3000";
}

export function manifestCorsHeaderRecord(request: NextRequest): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveManifestCorsOrigin(request),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

/** Same-origin relay avoids http→https mixed-content throttling on local dev. */
export function shouldUseLocalHlsRelay(request: NextRequest, upstreamUrl: string): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.MANIFEST_DISABLE_HLS_RELAY?.trim() === "1") return false;

  try {
    const upstream = new URL(upstreamUrl);
    if (upstream.protocol !== "https:") return false;

    const host = request.headers.get("host")?.trim() ?? "";
    if (!host.includes("localhost") && !host.startsWith("127.0.0.1")) return false;

    const pageProtocol = request.headers.get("x-forwarded-proto")?.trim() ?? "http";
    return pageProtocol === "http";
  } catch {
    return false;
  }
}

export function buildLocalHlsRelayUrl(request: NextRequest, upstreamUrl: string): string {
  const host = request.headers.get("host")?.trim() ?? "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto")?.trim() ?? "http";
  const relay = new URL("/api/stream/relay", `${protocol}://${host}`);
  relay.searchParams.set("target", upstreamUrl);
  return relay.toString();
}

export function resolveClientPlaybackUrl(request: NextRequest, upstreamUrl: string): string {
  if (shouldUseLocalHlsRelay(request, upstreamUrl)) {
    return buildLocalHlsRelayUrl(request, upstreamUrl);
  }
  return upstreamUrl;
}

export function buildMainStageEnvFastPathPayload(
  request: NextRequest,
  experience: ManifestExperienceKey,
): ManifestSuccessPayload | null {
  if (experience !== "main_stage") return null;
  if (!isAttendeePlaybackEnvPopulated()) return null;

  const playbackUrl = resolveConfiguredAttendeePlaybackFromEnv();
  if (!playbackUrl) return null;

  console.warn(
    `[stream/manifest] ATTENDEE_PLAYBACK_HLS_URL fast path → ${playbackUrl} [fallback=false]`,
  );

  return {
    success: true,
    playbackUrl: resolveClientPlaybackUrl(request, playbackUrl),
    activeExperience: experience,
    activeSource: "primary",
    fallback: false,
  };
}

export function buildDevFallbackFastPathPayload(
  request: NextRequest,
  experience: ManifestExperienceKey,
  options?: { suppressDemoFallback?: boolean },
): ManifestSuccessPayload | null {
  if (!isDevManifestFallbackEnabled()) return null;

  const productionPayload = buildProductionEnvManifestPayload(experience);
  if (productionPayload) {
    return {
      ...productionPayload,
      playbackUrl: resolveClientPlaybackUrl(request, productionPayload.playbackUrl),
    };
  }

  const payload = buildDevManifestFallbackPayload(experience, "fast_path", options);
  if (!payload) return null;

  return {
    ...payload,
    playbackUrl: resolveClientPlaybackUrl(request, payload.playbackUrl),
  };
}
