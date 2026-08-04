"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLiveAccessEvaluation } from "@/lib/access";
import { LIVE_STREAM_STATE_BROADCAST_EVENT } from "@/lib/live/types";
import {
  acquirePlatformChannel,
  commitPlatformChannelSubscribe,
  registerPlatformListener,
  releasePlatformChannel,
  unregisterPlatformListener,
} from "@/lib/live/platform-channel";
import { getSupabase } from "@/lib/supabase/client";

const STREAM_STATE_LISTENER_ID = "live-stream-state-broadcast";

type UseLiveStreamStateOptions = {
  /** When false, skips network/realtime sync until lifecycle allows live routing. */
  enabled?: boolean;
};

type UseLiveStreamStateResult = {
  isLive: boolean;
  isLoading: boolean;
  error: string | null;
};

export function useLiveStreamState(
  options: UseLiveStreamStateOptions = {},
): UseLiveStreamStateResult {
  const { enabled = true } = options;
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const syncRef = useRef<() => Promise<void>>(async () => {});

  const syncFromAccessApi = useCallback(async () => {
    if (!enabled) return;

    try {
      const evaluation = await fetchLiveAccessEvaluation();
      setIsLive(evaluation.streamIsLive);
      setError(null);
    } catch (syncError) {
      console.error("Live stream state sync failed:", syncError);
      setError("Unable to load live stream status.");
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  syncRef.current = syncFromAccessApi;

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    let cancelled = false;
    let supabase: ReturnType<typeof getSupabase>;

    try {
      supabase = getSupabase();
    } catch (initError) {
      console.error("Live stream state init failed:", initError);
      queueMicrotask(() => {
        if (!cancelled) {
          setError("Live stream state is unavailable.");
          setIsLoading(false);
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (!cancelled) {
        void syncFromAccessApi();
      }
    });

    acquirePlatformChannel(supabase);

    registerPlatformListener(STREAM_STATE_LISTENER_ID, (channel) =>
      channel.on("broadcast", { event: LIVE_STREAM_STATE_BROADCAST_EVENT }, () => {
        if (cancelled) return;
        void syncRef.current();
      }),
    );

    commitPlatformChannelSubscribe();

    return () => {
      cancelled = true;
      unregisterPlatformListener(STREAM_STATE_LISTENER_ID);
      releasePlatformChannel(supabase);
    };
  }, [enabled, syncFromAccessApi]);

  return {
    isLive,
    isLoading: enabled ? isLoading : false,
    error: enabled ? error : null,
  };
}
