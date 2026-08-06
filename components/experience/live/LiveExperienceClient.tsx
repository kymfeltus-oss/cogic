"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import { EXPERIENCE_LIVE_PATH } from "@/lib/experience/live-routes";
import { buildAttendeeGateUrl } from "@/lib/auth/routing";
import { fetchLiveAccessEvaluation, type LiveAccessEvaluation } from "@/lib/access";
import { attachHlsPlayback } from "@/lib/live/attach-hls-playback";
import { requestLiveSeedWalletRefresh } from "@/lib/live/seed-wallet-events";
import { isDemoManifestPlaybackUrl } from "@/lib/live/manifest-dev-fallback";
import { getSupabase } from "@/lib/supabase/client";
import {
  clearDirectCameraChannelSignals,
  createDirectCameraClientId,
  createDirectCameraPeer,
  markDirectCameraChannelJoined,
  sendDirectCameraSignal,
  tryFlushDirectCameraChannelSignals,
  type DirectCameraSignal,
} from "@/lib/experience/direct-camera-live";
import { resolvePublisherBrowserChannel } from "@/lib/owner/direct-camera-channels";
import {
  acquirePlatformChannel,
  commitPlatformChannelSubscribe,
  registerPlatformListener,
  releasePlatformChannel,
  unregisterPlatformListener,
} from "@/lib/live/platform-channel";
import { LIVE_STREAM_STATE_BROADCAST_EVENT } from "@/lib/live/types";
import {
  attendeeStatusMessage,
  mapBroadcastStateToAttendeeStatus,
} from "@/lib/live/attendee-live-honesty";
import LiveRoomChatPanel from "@/components/experience/live/LiveRoomChatPanel";
import {
  LiveStreamReactionsProvider,
  useLiveStreamReactions,
} from "@/lib/experience/LiveStreamReactionsContext";

const LIVE_ACCESS_POLL_MS = 5_000;
const MANIFEST_RETRY_MS = 5_000;
const MANIFEST_SYNC_LISTENER_ID = "live-manifest-stream-sync";

type LiveExperienceClientProps = {
  initialProfile: AttendeeProfileSnapshot;
  /** `hub` embeds the player inside /live Live Hub without full-page chrome. */
  variant?: "standalone" | "hub";
};

type ManifestState =
  | { status: "idle"; playbackUrl: null; message: string }
  | { status: "loading"; playbackUrl: null; message: string }
  | { status: "ready"; playbackUrl: string; message: string }
  | { status: "waiting"; playbackUrl: null; message: string }
  | { status: "error"; playbackUrl: null; message: string };

type ManifestResponse = {
  success?: boolean;
  playbackUrl?: string;
  activeSource?: "primary" | "backup";
  fallback?: boolean;
  fallbackReason?: string;
  error?: string;
};

function resolveManifestMessage(response: ManifestResponse): ManifestState {
  const playbackUrl = response.playbackUrl?.trim() ?? "";

  if (!response.success || !playbackUrl) {
    return {
      status: "waiting",
      playbackUrl: null,
      message: response.error ?? "Waiting for the live playback URL.",
    };
  }

  const isDevStream = response.fallback === true || isDemoManifestPlaybackUrl(playbackUrl);
  const routeLabel =
    response.activeSource === "backup" ? "Backup feed connected." : "Live stream connected.";

  return {
    status: "ready",
    playbackUrl,
    message: isDevStream ? "Playing development test stream." : routeLabel,
  };
}

function LiveReactionsBurst() {
  const { floatingReactions } = useLiveStreamReactions();
  if (floatingReactions.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      {floatingReactions.map((reaction) => (
        <span
          key={reaction.key}
          className="absolute bottom-24 text-2xl"
          style={{ left: `${Math.round(reaction.originX * 100)}%` }}
        >
          {reaction.emoji}
        </span>
      ))}
    </div>
  );
}

export default function LiveExperienceClient({
  initialProfile,
  variant = "standalone",
}: LiveExperienceClientProps) {
  return (
    <LiveStreamReactionsProvider enabled>
      <LiveExperienceClientInner initialProfile={initialProfile} variant={variant} />
    </LiveStreamReactionsProvider>
  );
}

function LiveExperienceClientInner({
  initialProfile,
  variant = "standalone",
}: LiveExperienceClientProps) {
  const isHub = variant === "hub";
  const attendeeName = initialProfile.headerDisplayName || initialProfile.email || "Guest";
  const reactions = useLiveStreamReactions();
  const videoRef = useRef<HTMLVideoElement>(null);
  const directVideoRef = useRef<HTMLVideoElement>(null);
  const hlsCleanupRef = useRef<(() => void) | null>(null);
  const directPeerRef = useRef<RTCPeerConnection | null>(null);
  const directChannelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null);
  const directBrowserChannelRef = useRef<BroadcastChannel | null>(null);
  const viewerIdRef = useRef(createDirectCameraClientId("viewer"));
  const directAudioUnlockedRef = useRef(false);
  const handleDirectSignalRef = useRef<(payload: DirectCameraSignal) => Promise<void>>(async () => {});
  const requestDirectOfferRef = useRef<() => void>(() => {});
  const signalingIntervalRef = useRef<number | null>(null);
  const isSignalingRef = useRef(false);
  const handshakeCompleteRef = useRef(false);
  const offerInFlightRef = useRef(false);
  const directStatusRef = useRef<"idle" | "connecting" | "ready">("idle");
  const componentIsUnmountingRef = useRef(false);
  const accessSyncInFlightRef = useRef(false);
  const manifestInFlightRef = useRef(false);
  const loadManifestRef = useRef<() => Promise<void>>(async () => {});
  const syncAccessRef = useRef<() => Promise<void>>(async () => {});
  const [access, setAccess] = useState<LiveAccessEvaluation | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ManifestState>({
    status: "idle",
    playbackUrl: null,
    message: "Checking live broadcast.",
  });
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [directAudioUnlocked, setDirectAudioUnlocked] = useState(false);
  const [directStatus, setDirectStatus] = useState<"idle" | "connecting" | "ready">("idle");
  const [directMessage, setDirectMessage] = useState("Waiting for direct camera publisher.");

  const useDirectCamera =
    access?.publishMode === "browser_camera" &&
    access.streamIsLive &&
    Boolean(access.publisherChannel?.trim());
  const directLiveChannel = access?.publisherChannel?.trim() ?? "";
  const directBrowserChannel = directLiveChannel
    ? resolvePublisherBrowserChannel(directLiveChannel)
    : "";

  useEffect(() => {
    directAudioUnlockedRef.current = directAudioUnlocked;
  }, [directAudioUnlocked]);

  useEffect(() => {
    directStatusRef.current = directStatus;
  }, [directStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("seeds") !== "success") return;

    requestLiveSeedWalletRefresh();

    const url = new URL(window.location.href);
    url.pathname = EXPERIENCE_LIVE_PATH;
    url.searchParams.delete("seeds");
    const query = url.searchParams.toString();
    window.history.replaceState({}, "", query ? `${url.pathname}?${query}` : url.pathname);
  }, []);

  useEffect(() => {
    return () => {
      componentIsUnmountingRef.current = true;
    };
  }, []);

  const sendDirectSignal = useCallback((payload: DirectCameraSignal) => {
    sendDirectCameraSignal(directChannelRef.current, payload);
    directBrowserChannelRef.current?.postMessage(payload);
  }, []);

  const clearViewerSignalingInterval = useCallback(() => {
    if (signalingIntervalRef.current !== null) {
      window.clearInterval(signalingIntervalRef.current);
      signalingIntervalRef.current = null;
    }
  }, []);

  const closeDirectPeer = useCallback(() => {
    handshakeCompleteRef.current = false;
    offerInFlightRef.current = false;
    directPeerRef.current?.close();
    directPeerRef.current = null;
    if (directVideoRef.current) {
      directVideoRef.current.srcObject = null;
    }
    setDirectStatus("idle");
    setDirectMessage("Waiting for direct camera publisher.");
  }, []);

  const requestDirectOffer = useCallback(() => {
    if (isSignalingRef.current || directStatusRef.current === "ready") return;

    isSignalingRef.current = true;
    try {
      if (directStatusRef.current !== "connecting") {
        setDirectStatus("connecting");
        setDirectMessage("Looking for a direct camera publisher...");
      }
      sendDirectSignal({ type: "viewer-ready", viewerId: viewerIdRef.current });
      tryFlushDirectCameraChannelSignals(directChannelRef.current);
    } finally {
      isSignalingRef.current = false;
    }
  }, [sendDirectSignal]);

  const handleDirectSignal = useCallback(
    async (payload: DirectCameraSignal) => {
      if (payload.type === "publisher-online") {
        requestDirectOffer();
        return;
      }

      if (payload.type === "publisher-offline") {
        closeDirectPeer();
        return;
      }

      if (payload.type === "offer" && payload.viewerId === viewerIdRef.current) {
        const existingPeer = directPeerRef.current;

        if (
          handshakeCompleteRef.current ||
          directStatusRef.current === "ready" ||
          (existingPeer?.signalingState === "stable" && existingPeer.connectionState === "connected")
        ) {
          console.log(
            "[WebRTC] Connection is already stable. Skipping duplicate remote description.",
          );
          return;
        }

        if (offerInFlightRef.current) {
          console.warn("[WebRTC] Offer handshake already in progress. Skipping duplicate offer.");
          return;
        }

        if (
          existingPeer &&
          existingPeer.signalingState !== "stable" &&
          existingPeer.signalingState !== "closed"
        ) {
          console.warn(
            `[WebRTC] Unexpected signaling state: ${existingPeer.signalingState}. Skipping overlapping offer.`,
          );
          return;
        }

        existingPeer?.close();
        const peer = createDirectCameraPeer();
        directPeerRef.current = peer;
        offerInFlightRef.current = true;
        handshakeCompleteRef.current = false;

        peer.ontrack = (event) => {
          const [stream] = event.streams;
          if (!stream || !directVideoRef.current) return;
          directVideoRef.current.srcObject = stream;
          directVideoRef.current.muted = !directAudioUnlockedRef.current;
          void directVideoRef.current.play().catch(() => undefined);
          setDirectStatus("ready");
          setDirectMessage("Direct camera live.");
        };
        peer.onicecandidate = (event) => {
          if (!event.candidate) return;
          sendDirectSignal({
            type: "ice",
            targetId: payload.publisherId,
            senderId: viewerIdRef.current,
            candidate: event.candidate.toJSON(),
          });
        };
        peer.onconnectionstatechange = () => {
          if (["closed", "disconnected", "failed"].includes(peer.connectionState)) {
            closeDirectPeer();
          }
        };

        if (peer.signalingState !== "stable") {
          console.warn(`[WebRTC] Unexpected signaling state: ${peer.signalingState}`);
          offerInFlightRef.current = false;
          return;
        }

        try {
          await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          console.log(
            `[WebRTC] Remote offer applied. Signaling state: ${peer.signalingState}`,
          );

          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          console.log(
            `[WebRTC] Local answer applied. Signaling state: ${peer.signalingState}`,
          );

          sendDirectSignal({
            type: "answer",
            viewerId: viewerIdRef.current,
            publisherId: payload.publisherId,
            sdp: answer,
          });

          if (peer.signalingState === "stable") {
            console.log("[WebRTC] Handshake complete: have-remote-offer → stable");
            handshakeCompleteRef.current = true;
            clearViewerSignalingInterval();
          }
        } catch (error) {
          console.error("[WebRTC] Failed to set remote description:", error);
          closeDirectPeer();
        } finally {
          offerInFlightRef.current = false;
        }
        return;
      }

      if (payload.type === "answer" && payload.viewerId === viewerIdRef.current) {
        const pc = directPeerRef.current;
        if (!pc || pc.signalingState === "stable") {
          console.log(
            "[WebRTC] Connection is already stable. Skipping duplicate remote description.",
          );
          return;
        }
        if (pc.signalingState !== "have-local-offer") {
          console.warn(`[WebRTC] Unexpected signaling state: ${pc.signalingState}`);
          return;
        }
        return;
      }

      if (payload.type === "ice" && payload.targetId === viewerIdRef.current) {
        const pc = directPeerRef.current;
        if (!pc || pc.signalingState === "closed") return;
        try {
          await pc.addIceCandidate(payload.candidate);
        } catch (error) {
          console.warn("[WebRTC] Failed to add ICE candidate:", error);
        }
      }
    },
    [clearViewerSignalingInterval, closeDirectPeer, requestDirectOffer, sendDirectSignal],
  );

  useEffect(() => {
    handleDirectSignalRef.current = handleDirectSignal;
  }, [handleDirectSignal]);

  useEffect(() => {
    requestDirectOfferRef.current = requestDirectOffer;
  }, [requestDirectOffer]);

  useEffect(() => {
    if (!useDirectCamera || !directLiveChannel) return;

    const supabase = getSupabase();
    const channel = supabase.channel(directLiveChannel, {
      config: { broadcast: { self: false } },
    });
    directChannelRef.current = channel;

    channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      void handleDirectSignalRef.current(payload as DirectCameraSignal);
    });
    channel.subscribe((subscribeStatus) => {
      if (subscribeStatus === "SUBSCRIBED") {
        markDirectCameraChannelJoined(channel);
        requestDirectOfferRef.current();
      }
    });

    if ("BroadcastChannel" in window && directBrowserChannel) {
      const browserChannel = new BroadcastChannel(directBrowserChannel);
      browserChannel.onmessage = (event: MessageEvent<DirectCameraSignal>) => {
        void handleDirectSignalRef.current(event.data);
      };
      directBrowserChannelRef.current = browserChannel;
    }

    if (signalingIntervalRef.current === null) {
      signalingIntervalRef.current = window.setInterval(() => {
        if (directStatusRef.current === "ready") return;
        requestDirectOfferRef.current();
      }, 5_000);
    }

    return () => {
      if (signalingIntervalRef.current !== null) {
        window.clearInterval(signalingIntervalRef.current);
        signalingIntervalRef.current = null;
      }
      clearDirectCameraChannelSignals(channel);
      closeDirectPeer();
      void supabase.removeChannel(channel);
      if (directChannelRef.current === channel) directChannelRef.current = null;
      directBrowserChannelRef.current?.close();
      directBrowserChannelRef.current = null;
    };
  }, [closeDirectPeer, directBrowserChannel, directLiveChannel, useDirectCamera]);

  const syncAccess = useCallback(async () => {
    if (accessSyncInFlightRef.current) return;
    accessSyncInFlightRef.current = true;
    try {
      const evaluation = await fetchLiveAccessEvaluation();
      if (componentIsUnmountingRef.current) return;
      setAccess(evaluation);
      setAccessError(null);
    } catch {
      if (componentIsUnmountingRef.current) return;
      setAccessError("Unable to check live access. Retrying...");
    } finally {
      accessSyncInFlightRef.current = false;
    }
  }, []);

  syncAccessRef.current = syncAccess;

  useEffect(() => {
    queueMicrotask(() => void syncAccess());
    const intervalId = window.setInterval(() => void syncAccess(), LIVE_ACCESS_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [syncAccess]);

  const loadManifest = useCallback(async () => {
    if (manifestInFlightRef.current) return;
    manifestInFlightRef.current = true;

    setManifest((prev) =>
      prev.status === "ready" || prev.status === "loading"
        ? prev
        : {
            status: "loading",
            playbackUrl: null,
            message: "Looking for the live playback URL.",
          },
    );

    try {
      const response = await fetch("/api/stream/manifest?experience=main_stage", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (componentIsUnmountingRef.current) return;

      if (!response.ok) {
        setManifest({
          status: response.status === 404 ? "waiting" : "error",
          playbackUrl: null,
          message:
            response.status === 404
              ? "The broadcast is not live yet."
              : `Live playback is unavailable (${response.status}).`,
        });
        return;
      }

      const data = (await response.json()) as ManifestResponse;
      if (componentIsUnmountingRef.current) return;
      setManifest(resolveManifestMessage(data));
    } catch {
      if (componentIsUnmountingRef.current) return;
      setManifest({
        status: "error",
        playbackUrl: null,
        message: "Could not load the live playback URL.",
      });
    } finally {
      manifestInFlightRef.current = false;
    }
  }, []);

  loadManifestRef.current = loadManifest;

  useEffect(() => {
    if (useDirectCamera) return;

    let cancelled = false;
    let supabase: ReturnType<typeof getSupabase>;

    try {
      supabase = getSupabase();
    } catch {
      return;
    }

    acquirePlatformChannel(supabase);

    registerPlatformListener(MANIFEST_SYNC_LISTENER_ID, (channel) =>
      channel.on("broadcast", { event: LIVE_STREAM_STATE_BROADCAST_EVENT }, () => {
        if (cancelled) return;
        void syncAccessRef.current();
        void loadManifestRef.current();
      }),
    );

    commitPlatformChannelSubscribe();

    return () => {
      cancelled = true;
      unregisterPlatformListener(MANIFEST_SYNC_LISTENER_ID);
      releasePlatformChannel(supabase);
    };
  }, [useDirectCamera]);

  useEffect(() => {
    if (useDirectCamera) {
      queueMicrotask(() => {
        setManifest({
          status: "idle",
          playbackUrl: null,
          message: "Connecting to owner camera feed.",
        });
      });
      return;
    }

    if (!access?.canViewStream || !access.streamIsLive) {
      queueMicrotask(() => {
        setManifest({
          status: "idle",
          playbackUrl: null,
          message: "Waiting for the broadcast to begin.",
        });
      });
      return;
    }

    queueMicrotask(() => void loadManifest());
    const intervalId = window.setInterval(() => void loadManifest(), MANIFEST_RETRY_MS);
    return () => window.clearInterval(intervalId);
  }, [access?.canViewStream, access?.streamIsLive, loadManifest, useDirectCamera]);

  const streamUrl = manifest.playbackUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) {
      hlsCleanupRef.current?.();
      hlsCleanupRef.current = null;
      if (video) {
        video.removeAttribute("src");
        video.load();
      }
      return;
    }

    video.muted = !audioUnlocked;
    let cancelled = false;

    void attachHlsPlayback(video, streamUrl, {
      onFatalError: (details) => {
        if (cancelled) return;
        setManifest({
          status: "error",
          playbackUrl: null,
          message: `Live playback failed: ${details}.`,
        });
      },
    }).then((cleanup) => {
      if (cancelled) {
        cleanup();
        return;
      }
      hlsCleanupRef.current?.();
      hlsCleanupRef.current = cleanup;
    });

    return () => {
      cancelled = true;
      hlsCleanupRef.current?.();
      hlsCleanupRef.current = null;
    };
  }, [audioUnlocked, streamUrl]);

  const enableAudio = useCallback(() => {
    const video = videoRef.current;
    setAudioUnlocked(true);
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    void video.play().catch(() => undefined);
  }, []);

  const enableDirectAudio = useCallback(() => {
    const video = directVideoRef.current;
    setDirectAudioUnlocked(true);
    if (!video) return;
    video.muted = false;
    void video.play().catch(() => undefined);
  }, []);

  const locked = access && !access.authenticated;
  const waitingForAccess = !access && !accessError;
  const showPlayer = Boolean(manifest.playbackUrl) && !useDirectCamera;
  const showDirectPlayer = useDirectCamera && directStatus === "ready";
  const broadcastStatus = access
    ? mapBroadcastStateToAttendeeStatus(access.currentState, access.streamIsLive)
    : waitingForAccess
      ? "loading"
      : "offline";
  const statusLabel =
    showDirectPlayer || showPlayer
      ? "Live"
      : broadcastStatus === "starting_soon"
        ? "Starting soon"
        : broadcastStatus === "scheduled"
          ? "Scheduled"
          : broadcastStatus === "live"
            ? "Connecting"
            : "Offline";
  const standbyMessage =
    directStatus === "connecting"
      ? directMessage
      : accessError
        ? accessError
        : manifest.status === "error"
          ? manifest.message
          : locked
            ? "Sign in to watch the live broadcast."
            : attendeeStatusMessage(broadcastStatus === "live" ? "starting_soon" : broadcastStatus);

  const retryPlayback = useCallback(() => {
    void syncAccess();
    void loadManifest();
  }, [loadManifest, syncAccess]);

  const playerStage = (
    <section
      className={
        isHub
          ? "relative h-full min-h-0 overflow-hidden bg-[#050505]"
          : "relative min-h-0 flex-1 overflow-hidden bg-[#050505]"
      }
    >
      {showDirectPlayer ? (
        <>
          <video
            ref={directVideoRef}
            className="absolute inset-0 h-full w-full bg-black object-contain"
            controls
            playsInline
            autoPlay
            muted={!directAudioUnlocked}
          />
          <LiveReactionsBurst />
          {!directAudioUnlocked ? (
            <button
              type="button"
              onClick={enableDirectAudio}
              className="absolute bottom-5 left-1/2 z-10 min-h-11 -translate-x-1/2 rounded-full border border-brand-blue/50 bg-black/75 px-5 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-brand-blue backdrop-blur"
            >
              Tap for audio
            </button>
          ) : null}
        </>
      ) : showPlayer ? (
        <>
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full bg-black object-contain"
            controls
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            playsInline
            preload="none"
            autoPlay
            muted={!audioUnlocked}
            crossOrigin="anonymous"
          />
          <LiveReactionsBurst />
          {!audioUnlocked ? (
            <button
              type="button"
              onClick={enableAudio}
              className="absolute bottom-5 left-1/2 z-10 min-h-11 -translate-x-1/2 rounded-full border border-brand-blue/50 bg-black/75 px-5 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-brand-blue backdrop-blur"
            >
              Tap for audio
            </button>
          ) : null}
          {reactions.enabled ? (
            <button
              type="button"
              disabled={reactions.isSending}
              onClick={() => void reactions.sendReaction("heart")}
              className="absolute bottom-5 right-4 z-10 min-h-11 rounded-full border border-white/20 bg-black/70 px-4 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white"
            >
              React
            </button>
          ) : null}
        </>
      ) : (
        <div
          className={
            isHub
              ? "flex h-full min-h-[16rem] items-center justify-center px-6 text-center"
              : "flex h-full min-h-[calc(100dvh-9rem)] items-center justify-center px-6 text-center"
          }
        >
          <div className="max-w-lg">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-brand-blue/40 bg-brand-blue/10">
              <span className="h-3 w-3 rounded-full bg-brand-blue shadow-[0_0_24px_rgba(83,252,255,0.75)]" />
            </div>
            <p className="font-ui text-[0.68rem] font-bold uppercase tracking-[0.18em] text-white/60">
              {waitingForAccess
                ? "Checking access"
                : locked
                  ? "Sign in required"
                  : statusLabel}
            </p>
            <p className="mt-4 font-body text-base text-white/80">{standbyMessage}</p>
            {manifest.status === "error" || accessError ? (
              <button
                type="button"
                onClick={retryPlayback}
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white"
              >
                Retry
              </button>
            ) : null}
            {locked ? (
              <Link
                href={buildAttendeeGateUrl(EXPERIENCE_LIVE_PATH)}
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-brand-blue/50 bg-brand-blue/10 px-6 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-brand-blue"
              >
                Sign in
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );

  if (isHub) {
    // Embeddable player only — Live Hub owns page chrome, giving, and media rails.
    return <div className="h-full min-h-0 bg-black text-white">{playerStage}</div>;
  }

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
          <div>
            <p className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.22em] text-brand-blue">
              COGIC LIVE
            </p>
            <h1 className="font-headline text-xl uppercase tracking-[0.08em] sm:text-2xl">
              Live
            </h1>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-ui text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/70">
            {statusLabel}
          </div>
        </header>

        {playerStage}

        <LiveRoomChatPanel enabled={Boolean(access?.authenticated)} />

        <footer className="flex items-center justify-between border-t border-white/10 bg-black px-4 py-3 font-body text-xs text-white/55 sm:px-6">
          <span>{attendeeName}</span>
          <span>
            {showDirectPlayer
              ? "Direct camera connected"
              : manifest.status === "ready"
                ? "Connected"
                : broadcastStatus}
          </span>
        </footer>
      </div>
    </main>
  );
}
