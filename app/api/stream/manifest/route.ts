import { NextRequest, NextResponse } from "next/server";
import {
  manifestCorsHeaderRecord,
  resolveClientPlaybackUrl,
} from "@/lib/live/manifest-env-fast-path";
import {
  buildDevManifestFallbackPayload,
  type ManifestExperienceKey,
} from "@/lib/live/manifest-dev-fallback";
import { resolveLiveManifestPlayback } from "@/lib/live/resolve-manifest-playback";

const EXPERIENCE_KEYS: readonly ManifestExperienceKey[] = [
  "main_stage",
  "crowd_xp",
  "musician_xp",
  "prayer_layer",
];

function parseExperience(request: NextRequest): ManifestExperienceKey | null {
  const raw = request.nextUrl.searchParams.get("experience");
  if (!raw || raw.trim() === "") return "main_stage";

  const trimmed = raw.trim() as ManifestExperienceKey;
  return EXPERIENCE_KEYS.includes(trimmed) ? trimmed : null;
}

function jsonResponse(
  request: NextRequest,
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      ...manifestCorsHeaderRecord(request),
      "Cache-Control": "private, max-age=10",
    },
  });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: manifestCorsHeaderRecord(request),
  });
}

export async function GET(request: NextRequest) {
  const experience = parseExperience(request);
  if (!experience) {
    return jsonResponse(request, { success: false, error: "Unknown stream experience." }, 400);
  }

  const resolved = await resolveLiveManifestPlayback();
  if (resolved.playbackUrl) {
    return jsonResponse(request, {
      success: true,
      activeExperience: experience,
      activeSource: resolved.activeSource,
      fallback: false,
      playbackUrl: resolveClientPlaybackUrl(request, resolved.playbackUrl),
    });
  }

  const fallbackPayload = buildDevManifestFallbackPayload(
    experience,
    "NO_CONFIGURED_HLS_PLAYBACK_URL",
    { suppressDemoFallback: true },
  );

  if (fallbackPayload) {
    return jsonResponse(request, {
      ...fallbackPayload,
      playbackUrl: resolveClientPlaybackUrl(request, fallbackPayload.playbackUrl),
    });
  }

  return jsonResponse(
    request,
    {
      success: false,
      error: "Live is open, but no HLS playback URL is configured.",
    },
    404,
  );
}
