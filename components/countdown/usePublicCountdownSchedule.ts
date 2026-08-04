"use client";

import { useEffect, useState } from "react";
import { useEventCountdown } from "@/lib/experience/useEventCountdown";
import {
  DEFAULT_COUNTDOWN_CONFIG,
  type EventCountdownConfig,
} from "@/lib/live/countdown-config";
import { COUNTDOWN_CONFIG_SYNC_MS } from "@/lib/live/countdown-config-sync";
import type { CountdownParts } from "@/lib/live/event-lobby";
import { useEventPhase } from "@/lib/live/useEventPhase";

type UsePublicCountdownScheduleOptions = {
  initialConfig: EventCountdownConfig;
  initialCountdown: CountdownParts;
};

export function usePublicCountdownSchedule({
  initialConfig,
  initialCountdown,
}: UsePublicCountdownScheduleOptions) {
  const [config, setConfig] = useState<EventCountdownConfig>(initialConfig);
  const [syncError, setSyncError] = useState(false);

  const countdown = useEventCountdown(config.start_time, initialCountdown);
  const eventPhase = useEventPhase(config.start_time, config.end_time);

  useEffect(() => {
    let cancelled = false;

    async function syncConfig() {
      try {
        const response = await fetch("/api/countdown", { cache: "no-store" });
        if (!response.ok) throw new Error("sync failed");
        const data = (await response.json()) as EventCountdownConfig;
        if (cancelled) return;
        setConfig(data);
        setSyncError(false);
      } catch {
        if (!cancelled) setSyncError(true);
      }
    }

    void syncConfig();
    const intervalId = window.setInterval(syncConfig, COUNTDOWN_CONFIG_SYNC_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const hasSchedule =
    Boolean(config.start_time?.trim()) &&
    !Number.isNaN(new Date(config.start_time).getTime());

  return {
    config: hasSchedule ? config : DEFAULT_COUNTDOWN_CONFIG,
    countdown,
    eventPhase,
    hasSchedule,
    syncError,
  };
}
