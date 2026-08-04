"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLiveAccessEvaluation } from "@/lib/access";
import {
  attendeeStatusMessage,
  isKnownAttendeeStreamId,
  mapBroadcastStateToAttendeeStatus,
  type AttendeeBroadcastStatus,
} from "@/lib/live/attendee-live-honesty";
import { LIVE_STREAM_STATE_BROADCAST_EVENT } from "@/lib/live/types";
import {
  acquirePlatformChannel,
  commitPlatformChannelSubscribe,
  registerPlatformListener,
  releasePlatformChannel,
  unregisterPlatformListener,
} from "@/lib/live/platform-channel";
import { getSupabase } from "@/lib/supabase/client";

export type LiveStreamState = {
  streamId: string;
  status: AttendeeBroadcastStatus;
  statusMessage: string;
  isLive: boolean;
  isLoading: boolean;
  error: string | null;
  /** Omitted — no production-backed viewer metric is exposed here. */
  viewerCount: null;
  videoUrl: string | null;
  posterUrl: string | null;
};

const STREAM_STATE_LISTENER_ID = "use-live-stream-honesty";

export function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

/**
 * Authoritative attendee stream state from /api/access/live + manifest.
 * Never fabricates viewers, chat, or live status.
 */
export function useLiveStream(streamId: string): LiveStreamState {
  const known = isKnownAttendeeStreamId(streamId);
  const [status, setStatus] = useState<AttendeeBroadcastStatus>(
    known ? "loading" : "unavailable",
  );
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(known);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (!known) {
      setStatus("unavailable");
      setIsLive(false);
      setIsLoading(false);
      setVideoUrl(null);
      return;
    }

    try {
      const evaluation = await fetchLiveAccessEvaluation();
      const nextStatus = mapBroadcastStateToAttendeeStatus(
        evaluation.currentState,
        evaluation.streamIsLive,
      );
      setIsLive(evaluation.streamIsLive);
      setStatus(nextStatus);
      setError(null);

      if (evaluation.streamIsLive && evaluation.canViewStream) {
        const response = await fetch("/api/stream/manifest?experience=main_stage", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          setVideoUrl(null);
          if (response.status !== 404) {
            setStatus("error");
            setError(`Live playback is unavailable (${response.status}).`);
          }
          return;
        }
        const data = (await response.json()) as {
          success?: boolean;
          playbackUrl?: string;
          error?: string;
        };
        const playbackUrl = data.playbackUrl?.trim() ?? "";
        if (data.success && playbackUrl) {
          setVideoUrl(playbackUrl);
        } else {
          setVideoUrl(null);
          setStatus("starting_soon");
        }
      } else {
        setVideoUrl(null);
      }
    } catch (syncError) {
      console.error("Live stream sync failed:", syncError);
      setStatus("error");
      setError("Unable to load live stream status.");
      setVideoUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [known]);

  useEffect(() => {
    if (!known) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let cancelled = false;
    let supabase: ReturnType<typeof getSupabase>;

    try {
      supabase = getSupabase();
    } catch {
      queueMicrotask(() => {
        if (!cancelled) {
          setStatus("error");
          setError("Live stream state is unavailable.");
          setIsLoading(false);
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (!cancelled) void sync();
    });

    acquirePlatformChannel(supabase);
    registerPlatformListener(STREAM_STATE_LISTENER_ID, (channel) =>
      channel.on("broadcast", { event: LIVE_STREAM_STATE_BROADCAST_EVENT }, () => {
        if (cancelled) return;
        void sync();
      }),
    );
    commitPlatformChannelSubscribe();

    return () => {
      cancelled = true;
      unregisterPlatformListener(STREAM_STATE_LISTENER_ID);
      releasePlatformChannel(supabase);
    };
  }, [known, sync, streamId]);

  return {
    streamId,
    status,
    statusMessage: error ?? attendeeStatusMessage(status),
    isLive,
    isLoading,
    error,
    viewerCount: null,
    videoUrl,
    posterUrl: null,
  };
}
