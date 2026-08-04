"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_ATTENDEE_EXPERIENCE,
  type AttendeeExperienceKey,
} from "@/lib/experience/stream-experiences";
import { attachHlsPlayback } from "@/lib/live/attach-hls-playback";

const RECONNECT_DELAY_MS = 3_500;

const MANIFEST_HOT_SWAP_MS = 3_000;

type AttendeeStreamPlayerProps = {
  experience?: AttendeeExperienceKey;
  enabled: boolean;
  showPaywall: boolean;
  paywallOverlay?: ReactNode;
  onExperienceUnavailable?: (requested: AttendeeExperienceKey) => void;
  /** Render without the default stream stage frame wrapper. */
  embedded?: boolean;
};

export default function AttendeeStreamPlayer({
  experience = DEFAULT_ATTENDEE_EXPERIENCE,
  enabled,
  showPaywall,
  paywallOverlay,
  onExperienceUnavailable,
  embedded = false,
}: AttendeeStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsCleanupRef = useRef<(() => void) | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manifestInFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const playbackUrlRef = useRef("");
  const experienceRef = useRef(experience);
  const onUnavailableRef = useRef(onExperienceUnavailable);

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState("Connecting to live broadcast...");

  const shouldPlay = enabled && !showPaywall;
  const shouldPlayRef = useRef(shouldPlay);
  shouldPlayRef.current = shouldPlay;

  useEffect(() => {
    experienceRef.current = experience;
  }, [experience]);

  useEffect(() => {
    onUnavailableRef.current = onExperienceUnavailable;
  }, [onExperienceUnavailable]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const abortManifestFetch = useCallback(() => {
    manifestInFlightRef.current = false;
  }, []);

  const destroyPlayer = useCallback(() => {
    hlsCleanupRef.current?.();
    hlsCleanupRef.current = null;
    setStreamUrl(null);
    const video = videoRef.current;
    if (video) {
      video.removeAttribute("src");
      video.load();
    }
  }, []);

  const scheduleReconnectRef = useRef<() => void>(() => undefined);
  const loadStreamRef = useRef<() => Promise<string | null>>(async () => null);

  const notifyExperienceUnavailable = useCallback(() => {
    const requested = experienceRef.current;
    if (requested === DEFAULT_ATTENDEE_EXPERIENCE) return;
    onUnavailableRef.current?.(requested);
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!shouldPlay || !isMountedRef.current) return;
    clearReconnectTimer();
    setIsReconnecting(true);
    setIsPlaying(false);
    setIsBuffering(true);
    setPlaybackStatus("Reconnecting to live broadcast...");

    reconnectTimerRef.current = setTimeout(() => {
      void loadStreamRef.current().then((url) => {
        if (!isMountedRef.current) return;
        if (url) {
          playbackUrlRef.current = url;
          setStreamUrl(url);
          return;
        }
        scheduleReconnectRef.current();
      });
    }, RECONNECT_DELAY_MS);
  }, [clearReconnectTimer, shouldPlay]);

  const loadStream = useCallback(async (): Promise<string | null> => {
    if (!shouldPlayRef.current) return null;
    if (manifestInFlightRef.current) return playbackUrlRef.current || null;

    manifestInFlightRef.current = true;
    const requestedExperience = experienceRef.current;

    try {
      const response = await fetch(
        `/api/stream/manifest?experience=${encodeURIComponent(requestedExperience)}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );

      if (!shouldPlayRef.current || !isMountedRef.current) return null;

      if (!response.ok) {
        setPlaybackStatus(`Live manifest unavailable (${response.status}). Retrying...`);
        if (
          requestedExperience !== DEFAULT_ATTENDEE_EXPERIENCE &&
          (response.status === 503 || response.status === 400)
        ) {
          notifyExperienceUnavailable();
          return null;
        }
        scheduleReconnectRef.current();
        return null;
      }

      const data = (await response.json()) as {
        success?: boolean;
        playbackUrl?: string;
      };

      if (!shouldPlayRef.current || !isMountedRef.current) return null;

      const playbackUrl = data.playbackUrl?.trim() ?? "";
      if (!data.success || !playbackUrl) {
        setPlaybackStatus("Live manifest did not include a playback URL. Retrying...");
        if (requestedExperience !== DEFAULT_ATTENDEE_EXPERIENCE) {
          notifyExperienceUnavailable();
          return null;
        }
        scheduleReconnectRef.current();
        return null;
      }

      playbackUrlRef.current = playbackUrl;
      return playbackUrl;
    } catch (error) {
      if (!shouldPlayRef.current || !isMountedRef.current) return null;
      console.error("[Telemetry Error]", error);
      setPlaybackStatus("Could not load the live manifest. Retrying...");
      scheduleReconnectRef.current();
      return null;
    } finally {
      manifestInFlightRef.current = false;
    }
  }, [notifyExperienceUnavailable]);

  useEffect(() => {
    scheduleReconnectRef.current = scheduleReconnect;
    loadStreamRef.current = loadStream;
  }, [loadStream, scheduleReconnect]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!shouldPlay) {
      clearReconnectTimer();
      destroyPlayer();
      queueMicrotask(() => {
        if (!isMountedRef.current) return;
        setIsReconnecting(false);
        setIsBuffering(false);
        setIsPlaying(false);
        setPlaybackStatus("Live stream paused.");
      });
      playbackUrlRef.current = "";
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled || !isMountedRef.current) return;
      setIsReconnecting(false);
      setIsBuffering(true);
      setIsPlaying(false);
      setPlaybackStatus("Connecting to live broadcast...");
    });

    void loadStreamRef.current().then((url) => {
      if (cancelled || !isMountedRef.current || !url) return;
      playbackUrlRef.current = url;
      setStreamUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [clearReconnectTimer, destroyPlayer, experience, shouldPlay]);

  useEffect(() => {
    return () => {
      abortManifestFetch();
      clearReconnectTimer();
      destroyPlayer();
    };
  }, [abortManifestFetch, clearReconnectTimer, destroyPlayer]);

  useEffect(() => {
    if (!shouldPlay) return;

    const intervalId = window.setInterval(() => {
      void loadStreamRef.current().then((url) => {
        if (!url || !isMountedRef.current || !shouldPlayRef.current) return;
        if (url === playbackUrlRef.current) return;
        playbackUrlRef.current = url;
        setStreamUrl(url);
      });
    }, MANIFEST_HOT_SWAP_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [shouldPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldPlay || !streamUrl) {
      hlsCleanupRef.current?.();
      hlsCleanupRef.current = null;
      return;
    }

    video.muted = !audioUnlocked;
    let cancelled = false;

    setPlaybackStatus("Loading live stream...");

    void attachHlsPlayback(video, streamUrl, {
      onManifestParsed: () => {
        if (cancelled) return;
        setIsReconnecting(false);
        setIsBuffering(false);
        setPlaybackStatus("Starting live video...");
      },
      onFatalError: () => {
        if (cancelled) return;
        console.error("[Telemetry Error] HLS fatal error");
        setPlaybackStatus("Live stream playback error. Retrying...");
        scheduleReconnectRef.current();
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
  }, [audioUnlocked, shouldPlay, streamUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldPlay) return;

    const onPlaying = () => {
      setIsPlaying(true);
      setIsReconnecting(false);
      setIsBuffering(false);
      setPlaybackStatus("Live video playing.");
    };
    const onWaiting = () => {
      setIsBuffering(true);
      setPlaybackStatus("Live video is buffering...");
    };
    const onError = () => {
      const code = video.error?.code;
      setPlaybackStatus(`Video element error${code ? ` ${code}` : ""}. Retrying...`);
      scheduleReconnectRef.current();
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onError);
    };
  }, [shouldPlay]);

  const enableAudio = useCallback(() => {
    const video = videoRef.current;
    setAudioUnlocked(true);
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    void video.play().catch(() => undefined);
  }, []);

  if (!enabled && !showPaywall) return null;

  const playerShellClass = `experience-player-fit relative aspect-[21/9] w-full overflow-hidden bg-[#0B090A] ${
    embedded
      ? ""
      : "experience-stream-stage rounded-none"
  }`;

  if (showPaywall) {
    return (
      <div className={playerShellClass}>
        {paywallOverlay ?? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="font-ui text-[0.62rem] font-bold uppercase tracking-[0.16em] text-zinc-300">
              Live pass required to watch the stream
            </p>
          </div>
        )}
      </div>
    );
  }

  const showRecovery = isReconnecting || isBuffering || !isPlaying;

  return (
    <div className={playerShellClass}>
      <video
        ref={videoRef}
        className={`absolute inset-0 z-0 h-full w-full bg-black object-cover ${
          isPlaying && !showRecovery ? "opacity-100" : "opacity-0"
        }`}
        controls={isPlaying && !showRecovery}
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        playsInline
        preload="none"
        autoPlay
        muted={!audioUnlocked}
        crossOrigin="anonymous"
      />

      {showRecovery && (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center experience-recovery-overlay px-6 text-center">
          <div className="flex h-8 items-end justify-center gap-1" aria-hidden="true">
            <span className="live-waveform-bar w-1 rounded-full bg-[#1E40AF]/70" style={{ animationDelay: "0ms" }} />
            <span className="live-waveform-bar w-1 rounded-full bg-[#1E40AF]/70" style={{ animationDelay: "150ms" }} />
            <span className="live-waveform-bar w-1 rounded-full bg-[#1E40AF]/70" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="mt-4 max-w-sm font-ui text-[0.62rem] font-bold uppercase tracking-[0.16em] text-zinc-300">
            {playbackStatus}
          </p>
        </div>
      )}

      {isPlaying && !audioUnlocked ? (
        <button
          type="button"
          onClick={enableAudio}
          className="absolute bottom-5 left-1/2 z-10 min-h-11 -translate-x-1/2 rounded-full border border-brand-blue/50 bg-black/75 px-5 font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-brand-blue backdrop-blur"
        >
          Tap for audio
        </button>
      ) : null}

      {paywallOverlay}
    </div>
  );
}
