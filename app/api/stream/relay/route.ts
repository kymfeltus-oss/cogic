import { NextRequest, NextResponse } from "next/server";
import { isValidRelayTargetUrl, resolveRelayTargetCandidate } from "@/lib/live/hls";
import {
  manifestCorsHeaderRecord,
  resolveEnvPlaybackUrl,
} from "@/lib/live/manifest-env-fast-path";
import { isLiveAccessDevBypassEnabled } from "@/lib/access/live-dev-bypass";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";

const ALLOWED_HOST_SUFFIXES = [
  "test-streams.mux.dev",
  "stream.mux.com",
  "mux.dev",
  "mux.com",
  "restream.io",
];

function relayReject(reason: string, detail: Record<string, unknown> = {}): void {
  console.error("[Relay Reject Reason]", reason, detail);
}

function isAllowedUpstream(url: URL): boolean {
  if (!["http:", "https:"].includes(url.protocol)) {
    relayReject("invalid_protocol", { protocol: url.protocol, target: url.toString() });
    return false;
  }

  const envUrl = resolveEnvPlaybackUrl();
  if (envUrl) {
    try {
      if (new URL(envUrl).hostname.toLowerCase() === url.hostname.toLowerCase()) {
        return true;
      }
    } catch {
      relayReject("invalid_env_playback_url", { envUrl });
    }
  }

  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );

  if (!allowed) {
    relayReject("upstream_host_not_allowed", {
      host,
      allowedSuffixes: ALLOWED_HOST_SUFFIXES,
      target: url.toString(),
    });
  }

  return allowed;
}

function rewritePlaylistBody(body: string, upstreamUrl: URL, relayBase: URL): string {
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        const uriMatch = trimmed.match(/URI="([^"]+)"/i);
        if (uriMatch?.[1]) {
          const absolute = new URL(uriMatch[1], upstreamUrl).href;
          const relay = new URL(relayBase);
          relay.searchParams.set("target", absolute);
          return trimmed.replace(uriMatch[1], relay.toString());
        }
        return line;
      }

      const absolute = new URL(trimmed, upstreamUrl).href;
      const relay = new URL(relayBase);
      relay.searchParams.set("target", absolute);
      return relay.toString();
    })
    .join("\n");
}

async function authorizeRelay(request: NextRequest): Promise<boolean> {
  if (process.env.NODE_ENV !== "development") {
    relayReject("relay_disabled_outside_development", {
      nodeEnv: process.env.NODE_ENV,
    });
    return false;
  }

  const host = request.headers.get("host") ?? "";
  if (!host.includes("localhost") && !host.startsWith("127.0.0.1")) {
    relayReject("relay_host_not_local", { host });
    return false;
  }

  if (isLiveAccessDevBypassEnabled()) return true;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    relayReject("relay_unauthorized", { host });
  }

  return Boolean(user);
}

function relayResponse(
  request: NextRequest,
  body: BodyInit,
  contentType: string,
  status = 200,
): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      ...manifestCorsHeaderRecord(request),
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: manifestCorsHeaderRecord(request),
  });
}

/**
 * Dev-only same-origin HLS relay — avoids http localhost throttling https segment fetches.
 */
export async function GET(request: NextRequest) {
  if (!(await authorizeRelay(request))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const targetRaw = request.nextUrl.searchParams.get("target")?.trim() ?? "";
  if (!targetRaw) {
    relayReject("empty_target_param", { search: request.nextUrl.search });
    return NextResponse.json({ error: "Invalid target URL." }, { status: 400 });
  }

  const resolvedTarget = resolveRelayTargetCandidate(targetRaw);
  if (!resolvedTarget) {
    relayReject("invalid_relay_target_url", {
      targetRaw,
      isValidRelayTargetUrl: isValidRelayTargetUrl(targetRaw),
    });
    return NextResponse.json({ error: "Invalid target URL." }, { status: 400 });
  }

  let upstream: URL;
  try {
    upstream = new URL(resolvedTarget);
  } catch (error) {
    relayReject("target_url_parse_failed", {
      resolvedTarget,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid target URL." }, { status: 400 });
  }

  if (!isAllowedUpstream(upstream)) {
    return NextResponse.json({ error: "Upstream host not allowed." }, { status: 403 });
  }

  try {
    const upstreamResponse = await fetch(upstream.toString(), {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "*/*" },
    });

    if (!upstreamResponse.ok) {
      relayReject("upstream_fetch_failed", {
        target: upstream.toString(),
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
      });
      return relayResponse(request, "Upstream unavailable.", "text/plain", upstreamResponse.status);
    }

    const contentType =
      upstreamResponse.headers.get("content-type")?.trim() ??
      (upstream.pathname.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : "application/octet-stream");

    const isPlaylist =
      contentType.includes("mpegurl") ||
      contentType.includes("m3u8") ||
      upstream.pathname.endsWith(".m3u8");

    if (isPlaylist) {
      const text = await upstreamResponse.text();
      const relayBase = new URL("/api/stream/relay", request.nextUrl.origin);
      const rewritten = rewritePlaylistBody(text, upstream, relayBase);
      return relayResponse(request, rewritten, "application/vnd.apple.mpegurl");
    }

    const buffer = await upstreamResponse.arrayBuffer();
    return relayResponse(request, buffer, contentType);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Relay fetch failed.";
    relayReject("relay_fetch_exception", {
      target: upstream.toString(),
      error: message,
    });
    return relayResponse(request, message, "text/plain", 502);
  }
}
