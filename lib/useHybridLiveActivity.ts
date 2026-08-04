"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchRealLiveActivity } from "@/lib/live/fetch-live-activity";
import {
  getHybridActivity,
  HYBRID_ACTIVITY_VISIBLE_MAX,
  sliceVisibleActivity,
  type LiveActivityItem,
} from "@/lib/live/live-activity";
import { getSupabase } from "@/lib/supabase/client";

const ROTATE_MIN_MS = 8_000;
const ROTATE_MAX_MS = 15_000;

function randomRotationDelay(): number {
  return ROTATE_MIN_MS + Math.floor(Math.random() * (ROTATE_MAX_MS - ROTATE_MIN_MS));
}

export type UseHybridLiveActivityResult = {
  pool: LiveActivityItem[];
  visible: LiveActivityItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

type UseHybridLiveActivityOptions = {
  enabled?: boolean;
};

export function useHybridLiveActivity(
  options: UseHybridLiveActivityOptions = {},
): UseHybridLiveActivityResult {
  const enabled = options.enabled ?? true;
  const [pool, setPool] = useState<LiveActivityItem[]>(() =>
    getHybridActivity([]),
  );
  const [rotationIndex, setRotationIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef(false);
  const mountedRef = useRef(true);

  const visible = useMemo(
    () => sliceVisibleActivity(pool, rotationIndex, HYBRID_ACTIVITY_VISIBLE_MAX),
    [pool, rotationIndex],
  );

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;

    try {
      const supabase = getSupabase();
      const realItems = await fetchRealLiveActivity(supabase);
      if (!mountedRef.current) return;

      setPool(getHybridActivity(realItems));
      setRotationIndex(0);
      setError(null);
    } catch (refreshError) {
      console.error("Hybrid activity refresh failed:", refreshError);
      if (!mountedRef.current) return;

      setPool(getHybridActivity([]));
      setRotationIndex(0);
      setError("Activity feed is using community preview.");
    } finally {
      refreshInFlight.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    mountedRef.current = true;

    const startRefresh = () => {
      void refresh();
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(startRefresh, { timeout: 2_000 });
      return () => {
        mountedRef.current = false;
        window.cancelIdleCallback(idleId);
      };
    }

    const frameId = requestAnimationFrame(startRefresh);
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(frameId);
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (pool.length <= HYBRID_ACTIVITY_VISIBLE_MAX) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      timeoutId = setTimeout(() => {
        setRotationIndex((prev) => (prev + 1) % pool.length);
        schedule();
      }, randomRotationDelay());
    };

    schedule();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [pool]);

  return {
    pool,
    visible,
    isLoading,
    error,
    refresh,
  };
}
