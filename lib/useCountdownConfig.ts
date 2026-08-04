"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_COUNTDOWN_CONFIG,
  type EventCountdownConfig,
} from "@/lib/live/countdown-config";
import {
  COUNTDOWN_CONFIG_SYNC_MS,
  COUNTDOWN_CONFIG_UPDATED_EVENT,
} from "@/lib/live/countdown-config-sync";
import {
  loadLastKnownCountdown,
  saveLastKnownCountdown,
} from "@/lib/parable/last-known-good";
import { useParableSubsystem } from "@/lib/parable/useParableSubsystem";
import { parableFetch } from "@/lib/parable/resilient-fetch";
import { useBroadcastHealth } from "@/lib/parable/BroadcastHealthContext";

type UseCountdownConfigOptions = {
  initialConfig?: EventCountdownConfig;
};

export function useCountdownConfig(options: UseCountdownConfigOptions = {}) {
  const { shouldFetch } = useParableSubsystem("countdown");
  const { persistCountdownConfig } = useBroadcastHealth();
  const [config, setConfig] = useState<EventCountdownConfig>(() => {
    if (options.initialConfig) return options.initialConfig;
    return loadLastKnownCountdown() ?? DEFAULT_COUNTDOWN_CONFIG;
  });
  const [isLoading, setIsLoading] = useState(!options.initialConfig);
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);
  const shouldFetchRef = useRef(shouldFetch);
  const persistCountdownConfigRef = useRef(persistCountdownConfig);
  const initialConfigRef = useRef(options.initialConfig);
  shouldFetchRef.current = shouldFetch;
  persistCountdownConfigRef.current = persistCountdownConfig;
  initialConfigRef.current = options.initialConfig;

  useEffect(() => {
    if (!options.initialConfig) return;
    saveLastKnownCountdown(options.initialConfig);
  }, [
    options.initialConfig,
    options.initialConfig?.end_time,
    options.initialConfig?.start_time,
  ]);

  useEffect(() => {
    let cancelled = false;
    let abortController = new AbortController();

    async function load(isInitial = false) {
      if (!shouldFetchRef.current()) {
        if (!initialConfigRef.current) {
          const cached = loadLastKnownCountdown();
          if (cached && !cancelled) {
            setConfig(cached);
            setUsingLocalFallback(true);
          }
        }
        if (isInitial && !cancelled) setIsLoading(false);
        return;
      }

      try {
        const { response } = await parableFetch(
          "/api/countdown",
          { cache: "no-store", signal: abortController.signal },
          { subsystem: "countdown" },
        );

        if (!response.ok) throw new Error("fetch failed");
        const data = (await response.json()) as EventCountdownConfig;
        if (cancelled) return;

        setConfig(data);
        setUsingLocalFallback(false);
        saveLastKnownCountdown(data);
        persistCountdownConfigRef.current(data);
      } catch {
        if (abortController.signal.aborted || cancelled) return;

        if (initialConfigRef.current) {
          setConfig(initialConfigRef.current);
          setUsingLocalFallback(true);
        } else {
          const cached = loadLastKnownCountdown();
          if (cached) {
            setConfig(cached);
            setUsingLocalFallback(true);
          } else {
            setConfig(DEFAULT_COUNTDOWN_CONFIG);
            setUsingLocalFallback(true);
          }
        }
      } finally {
        if (isInitial && !cancelled) setIsLoading(false);
      }
    }

    const startLoad = () => {
      void load(true);
    };

    const onOpsSave = () => {
      abortController.abort();
      abortController = new AbortController();
      void load(false);
    };

    window.addEventListener(COUNTDOWN_CONFIG_UPDATED_EVENT, onOpsSave);

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(startLoad, { timeout: 1_000 });
      const pollId = window.setInterval(() => {
        abortController.abort();
        abortController = new AbortController();
        void load(false);
      }, COUNTDOWN_CONFIG_SYNC_MS);

      return () => {
        cancelled = true;
        abortController.abort();
        window.cancelIdleCallback(idleId);
        window.clearInterval(pollId);
        window.removeEventListener(COUNTDOWN_CONFIG_UPDATED_EVENT, onOpsSave);
      };
    }

    startLoad();
    const pollId = window.setInterval(() => {
      abortController.abort();
      abortController = new AbortController();
      void load(false);
    }, COUNTDOWN_CONFIG_SYNC_MS);

    return () => {
      cancelled = true;
      abortController.abort();
      window.clearInterval(pollId);
      window.removeEventListener(COUNTDOWN_CONFIG_UPDATED_EVENT, onOpsSave);
    };
  }, [
    options.initialConfig?.end_time,
    options.initialConfig?.id,
    options.initialConfig?.start_time,
  ]);

  return { config, isLoading, usingLocalFallback };
}
