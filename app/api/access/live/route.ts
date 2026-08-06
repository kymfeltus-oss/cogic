import { NextResponse } from "next/server";
import { evaluateLiveAccessFromFlags, parseAccessContext, type LivePublishMode } from "@/lib/access";
import { isLiveAccessDevBypassEnabled } from "@/lib/access/live-dev-bypass";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadOwnerStreamState } from "@/lib/owner/load-owner-state";
import { getPublishedOccurrences } from "@/lib/events/repository";
import { resolveAuthoritativeLiveState } from "@/lib/live/authoritative-state";
import { fetchManifestStreamConfig } from "@/lib/live/fetch-manifest-stream-config";

function normalizePublishMode(raw: unknown): LivePublishMode {
  if (
    raw === "external_hls" ||
    raw === "rtmp_encoder" ||
    raw === "browser_camera"
  ) {
    return raw;
  }
  return "none";
}

function buildStreamFlags(streamRow: Awaited<ReturnType<typeof loadOwnerStreamState>>["row"], liveStatus: ReturnType<typeof resolveAuthoritativeLiveState>) {
  const streamIsLive = streamRow?.is_live === true;
  return {
    streamIsLive: liveStatus === "live",
    currentState: streamRow?.current_state ?? (streamIsLive ? "live" : "offline"),
    publishMode: normalizePublishMode(streamRow?.publish_mode),
    publisherChannel: streamRow?.publisher_channel ?? null,
  };
}

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const { row: streamRow, error: streamError } = await loadOwnerStreamState(admin);

    if (streamError && !streamRow) {
      console.error("Live stream state load failed:", streamError);
      return NextResponse.json(
        { error: "Unable to evaluate live access." },
        { status: 500 },
      );
    }

    const [{ config: streamConfig }, occurrences] = await Promise.all([
      fetchManifestStreamConfig(admin),
      getPublishedOccurrences(),
    ]);
    const liveOccurrence = occurrences.find((occurrence) => occurrence.status === "live") ?? null;
    const liveStatus = resolveAuthoritativeLiveState(liveOccurrence, streamConfig);
    const streamFlags = buildStreamFlags(streamRow, liveStatus);

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      if (isLiveAccessDevBypassEnabled()) {
        return NextResponse.json({
          authenticated: true,
          userId: "dev-live-bypass",
          email: "dev-live-bypass@awakening.local",
          isGuest: true,
          hasPaidPass: true,
          canViewStream: true,
          showStreamPaywall: false,
          showFullLockdown: false,
          playbackUrl: "",
          ...streamFlags,
        });
      }
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }

    const context = parseAccessContext(user);

    if (!context.email) {
      if (isLiveAccessDevBypassEnabled()) {
        return NextResponse.json({
          authenticated: true,
          userId: context.userId ?? "dev-live-bypass",
          email: "dev-live-bypass@awakening.local",
          isGuest: true,
          hasPaidPass: true,
          canViewStream: true,
          showStreamPaywall: false,
          showFullLockdown: false,
          playbackUrl: "",
          ...streamFlags,
        });
      }
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }

    const evaluation = evaluateLiveAccessFromFlags(
      context.email,
      context.isGuest,
      false,
    );

    return NextResponse.json({
      ...evaluation,
      userId: context.userId,
      playbackUrl: "",
      ...streamFlags,
    });
  } catch (error) {
    console.error("Live access route error:", error);
    return NextResponse.json(
      { error: "Unable to evaluate live access." },
      { status: 500 },
    );
  }
}
