"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  centsToDollars,
  fetchHarvestProgressCents,
  HARVEST_GOAL_DOLLARS,
} from "@/lib/live/harvest-metrics";
import {
  buildChannelName,
  createRealtimeChannel,
  teardownRealtimeChannel,
} from "@/lib/live/realtime-subscribe";
import { HARVEST_METRICS_CHANNEL } from "@/lib/live/types";
import { getSupabase } from "@/lib/supabase/client";

type UseHarvestMetricsResult = {
  totalRaised: number;
  goalDollars: number;
  progressPercent: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

function reportHarvestFailure(
  cancelled: boolean,
  setIsLoading: (value: boolean) => void,
  setError: (value: string | null) => void,
  message: string,
) {
  if (cancelled) return;

  queueMicrotask(() => {
    if (cancelled) return;
    setIsLoading(false);
    setError(message);
  });
}

export function useHarvestMetrics(): UseHarvestMetricsResult {
  const instanceId = useId().replace(/:/g, "");
  const channelRef = useRef<Awaited<ReturnType<typeof createRealtimeChannel>> | null>(
    null,
  );

  const [totalRaised, setTotalRaised] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef(false);

  const applyTotalCents = useCallback((totalCents: number) => {
    setTotalRaised(centsToDollars(totalCents));
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;

    try {
      const supabase = getSupabase();
      const totalCents = await fetchHarvestProgressCents(supabase);
      applyTotalCents(totalCents);
    } catch (refreshError) {
      console.error("Harvest metrics refresh failed:", refreshError);
      setError("Unable to load harvest progress.");
    } finally {
      refreshInFlight.current = false;
      setIsLoading(false);
    }
  }, [applyTotalCents]);

  useEffect(() => {
    let cancelled = false;
    let supabase: ReturnType<typeof getSupabase>;
    let setupPromise: Promise<void> = Promise.resolve();

    try {
      supabase = getSupabase();
    } catch (initError) {
      console.error("Harvest metrics init failed:", initError);
      reportHarvestFailure(
        cancelled,
        setIsLoading,
        setError,
        "Realtime metrics are unavailable.",
      );
      return;
    }

    const channelName = buildChannelName(HARVEST_METRICS_CHANNEL, instanceId);

    const handleHarvestUpdate = (totalCents: number) => {
      if (cancelled) return;
      applyTotalCents(totalCents);
      setIsLoading(false);
    };

    setupPromise = (async () => {
      try {
        const progressChannel = await createRealtimeChannel(
          supabase,
          channelName,
          {
            postgres: [
              {
                event: "UPDATE",
                schema: "public",
                table: "harvest_progress",
                callback: (payload) => {
                  const row = payload.new as { total_cents?: number };
                  if (typeof row.total_cents === "number") {
                    handleHarvestUpdate(row.total_cents);
                  }
                },
              },
              {
                event: "INSERT",
                schema: "public",
                table: "orders",
                callback: (payload) => {
                  const row = payload.new as { status?: string };
                  if (row.status === "paid") {
                    void refresh();
                  }
                },
              },
              {
                event: "UPDATE",
                schema: "public",
                table: "orders",
                callback: (payload) => {
                  const row = payload.new as { status?: string };
                  if (row.status === "paid") {
                    void refresh();
                  }
                },
              },
            ],
            broadcast: [
              {
                event: "harvest_refresh",
                callback: () => {
                  void refresh();
                },
              },
            ],
          },
          (status) => {
            if (status === "SUBSCRIBED" && !cancelled) {
              void refresh();
            }
          },
        );

        if (cancelled) {
          await teardownRealtimeChannel(supabase, progressChannel);
          return;
        }

        channelRef.current = progressChannel;
      } catch (subscribeError) {
        console.error("Harvest metrics channel subscribe failed:", subscribeError);
        reportHarvestFailure(
          cancelled,
          setIsLoading,
          setError,
          "Realtime metrics are unavailable.",
        );
      }
    })();

    return () => {
      cancelled = true;

      void (async () => {
        await setupPromise;
        const channel = channelRef.current;
        channelRef.current = null;
        await teardownRealtimeChannel(supabase, channel);
      })();
    };
  }, [applyTotalCents, instanceId, refresh]);

  const progressPercent = Math.min(
    100,
    (totalRaised / HARVEST_GOAL_DOLLARS) * 100,
  );

  return {
    totalRaised,
    goalDollars: HARVEST_GOAL_DOLLARS,
    progressPercent,
    isLoading,
    error,
    refresh,
  };
}
