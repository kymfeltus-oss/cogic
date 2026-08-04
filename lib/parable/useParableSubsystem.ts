"use client";

import { useCallback, useMemo } from "react";
import { useBroadcastHealth } from "@/lib/parable/BroadcastHealthContext";
import type { SubsystemId } from "@/lib/parable/health-types";

export function useParableSubsystem(id: SubsystemId) {
  const {
    isSubsystemIsolated,
    shouldFreezePolling,
    shouldAllowRealtime,
    reportSubsystemOutcome,
    isolateSubsystem,
    restoreSubsystem,
    safeMode,
  } = useBroadcastHealth();

  const shouldFetch = useCallback(
    () => !isSubsystemIsolated(id) && !shouldFreezePolling(),
    [id, isSubsystemIsolated, shouldFreezePolling],
  );

  const shouldAllowRealtimeSync = useCallback(
    () => shouldAllowRealtime() && !isSubsystemIsolated(id),
    [id, isSubsystemIsolated, shouldAllowRealtime],
  );

  const reportSuccess = useCallback(
    (latencyMs?: number) => reportSubsystemOutcome(id, "success", latencyMs),
    [id, reportSubsystemOutcome],
  );

  const reportFailure = useCallback(
    (message?: string) => {
      reportSubsystemOutcome(id, "failure", undefined, message);
      isolateSubsystem(id, `${labelFor(id)} paused to protect live stream.`);
    },
    [id, isolateSubsystem, reportSubsystemOutcome],
  );

  const restore = useCallback(() => restoreSubsystem(id), [id, restoreSubsystem]);

  const isolated = isSubsystemIsolated(id);

  return useMemo(
    () => ({
      shouldFetch,
      shouldAllowRealtime: shouldAllowRealtimeSync,
      reportSuccess,
      reportFailure,
      restore,
      isIsolated: isolated,
      safeMode,
    }),
    [
      isolated,
      reportFailure,
      reportSuccess,
      restore,
      safeMode,
      shouldAllowRealtimeSync,
      shouldFetch,
    ],
  );
}

function labelFor(id: SubsystemId): string {
  switch (id) {
    case "fellowship_chat":
      return "Chat";
    case "polls":
      return "Polls";
    case "seeds":
      return "Seeds";
    case "countdown":
      return "Countdown";
    case "giving":
      return "Giving";
    default:
      return "Feature";
  }
}
