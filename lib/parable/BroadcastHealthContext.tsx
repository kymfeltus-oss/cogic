"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EventCountdownConfig } from "@/lib/live/countdown-config";
import { ParableCommandGuard } from "@/lib/parable/command-guard";
import {
  registerParableHealthUpdater,
  unregisterParableHealthUpdater,
} from "@/lib/telemetry/healthBridge";
import type { SystemHealthMetrics } from "@/lib/telemetry/parableFetch";
import {
  ALERT_DEDUPE_MS,
  MAX_ALERTS,
  SNAPSHOT_POLL_CRITICAL_MS,
  SNAPSHOT_POLL_NORMAL_MS,
  SNAPSHOT_POLL_SLOW_MS,
  SUBSYSTEM_SUCCESS_WINDOW,
} from "@/lib/parable/health-thresholds";
import {
  aggregateSeverity,
  maxSeverity,
  severityFromSnapshotMetrics,
  severityIsCritical,
  shouldAutoEnableSafeMode,
} from "@/lib/parable/severity";
import {
  saveLastKnownCountdown,
  saveLastKnownSnapshot,
} from "@/lib/parable/last-known-good";
import type {
  BroadcastHealthSnapshot,
  CommandGuardResult,
  CommandLogEntry,
  CommandOutcome,
  HealthAlert,
  HealthSeverity,
  ParableSurface,
  ProductionStore,
  SubsystemHealth,
  SubsystemId,
} from "@/lib/parable/health-types";
import { createInitialSubsystems, isSubsystemId } from "@/lib/parable/health-types";

type SubsystemOutcome = "success" | "failure";

type BroadcastHealthContextValue = BroadcastHealthSnapshot & {
  surface: ParableSurface;
  pushAlert: (message: string, severity?: HealthSeverity, subsystem?: SubsystemId) => void;
  clearAlerts: () => void;
  setSafeModeManual: (enabled: boolean) => void;
  reportSnapshotSuccess: (store: ProductionStore, latencyMs: number) => void;
  reportSnapshotFailure: (error: unknown) => void;
  reportSubsystemOutcome: (
    id: SubsystemId,
    outcome: SubsystemOutcome,
    latencyMs?: number,
    message?: string,
  ) => void;
  isolateSubsystem: (id: SubsystemId, message: string) => void;
  restoreSubsystem: (id: SubsystemId) => void;
  isSubsystemIsolated: (id: SubsystemId) => boolean;
  shouldFreezePolling: () => boolean;
  shouldAllowRealtime: () => boolean;
  guardCommand: (
    action: string,
    extras?: Record<string, unknown>,
    confirmed?: boolean,
  ) => CommandGuardResult;
  recordCommandOutcome: (
    action: string,
    outcome: Exclude<CommandOutcome, "pending">,
    message?: string,
  ) => void;
  requiresCommandConfirmation: (action: string) => boolean;
  persistCountdownConfig: (config: EventCountdownConfig) => void;
  getCommandLog: () => CommandLogEntry[];
  resolveSnapshotPollInterval: () => number;
  updateSystemHealth: (metrics: SystemHealthMetrics) => void;
  isMocked: boolean;
  mockSimulateSeverity: (level: HealthSeverity | null) => void;
};

const noopGuard = new ParableCommandGuard();

const FALLBACK_VALUE: BroadcastHealthContextValue = {
  surface: "experience",
  severity: "GREEN",
  safeMode: false,
  safeModeManual: false,
  subsystems: createInitialSubsystems(),
  alerts: [],
  commandLog: [],
  lastSnapshotSuccessAt: null,
  snapshotPollIntervalMs: SNAPSHOT_POLL_NORMAL_MS,
  pollingFrozen: false,
  usingCachedSnapshot: false,
  pushAlert: () => {},
  clearAlerts: () => {},
  setSafeModeManual: () => {},
  reportSnapshotSuccess: () => {},
  reportSnapshotFailure: () => {},
  reportSubsystemOutcome: () => {},
  isolateSubsystem: () => {},
  restoreSubsystem: () => {},
  isSubsystemIsolated: () => false,
  shouldFreezePolling: () => false,
  shouldAllowRealtime: () => true,
  guardCommand: (action, extras, confirmed) =>
    noopGuard.guard(action, extras, confirmed),
  recordCommandOutcome: (action, outcome, message) =>
    noopGuard.recordOutcome(action, outcome, message),
  requiresCommandConfirmation: () => false,
  persistCountdownConfig: (config) => saveLastKnownCountdown(config),
  getCommandLog: () => [],
  resolveSnapshotPollInterval: () => SNAPSHOT_POLL_NORMAL_MS,
  updateSystemHealth: () => {},
  isMocked: false,
  mockSimulateSeverity: () => {},
};

const BroadcastHealthContext = createContext<BroadcastHealthContextValue>(FALLBACK_VALUE);

function updateSubsystem(
  current: Record<SubsystemId, SubsystemHealth>,
  id: SubsystemId,
  patch: Partial<SubsystemHealth>,
): Record<SubsystemId, SubsystemHealth> {
  return {
    ...current,
    [id]: {
      ...current[id],
      ...patch,
      id,
    },
  };
}

function computeSuccessRate(previous: number, outcome: SubsystemOutcome): number {
  const weight = 1 / SUBSYSTEM_SUCCESS_WINDOW;
  const sample = outcome === "success" ? 1 : 0;
  return Math.max(0, Math.min(1, previous * (1 - weight) + sample * weight));
}

type BroadcastHealthProviderProps = {
  children: ReactNode;
  surface?: ParableSurface;
};

export function BroadcastHealthProvider({
  children,
  surface = "broadcast",
}: BroadcastHealthProviderProps) {
  const commandGuardRef = useRef(new ParableCommandGuard());
  const snapshotFailureStreakRef = useRef(0);
  const lastAlertRef = useRef<Map<string, number>>(new Map());

  const [subsystems, setSubsystems] = useState(createInitialSubsystems);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [safeModeManual, setSafeModeManualState] = useState(false);
  const [autoSafeMode, setAutoSafeMode] = useState(false);
  const [lastSnapshotSuccessAt, setLastSnapshotSuccessAt] = useState<number | null>(null);
  const [snapshotPollIntervalMs, setSnapshotPollIntervalMs] = useState(SNAPSHOT_POLL_NORMAL_MS);
  const [pollingFrozen, setPollingFrozen] = useState(false);
  const [usingCachedSnapshot, setUsingCachedSnapshot] = useState(false);
  const [snapshotSeverity, setSnapshotSeverity] = useState<HealthSeverity>("GREEN");
  const [mockedSeverity, setMockedSeverity] = useState<HealthSeverity | null>(null);
  const mockedSeverityRef = useRef<HealthSeverity | null>(null);

  useEffect(() => {
    mockedSeverityRef.current = mockedSeverity;
  }, [mockedSeverity]);

  const isMocked = mockedSeverity !== null;

  const pushAlert = useCallback(
    (message: string, severity: HealthSeverity = "YELLOW", subsystem?: SubsystemId) => {
      const dedupeKey = `${subsystem ?? "global"}:${message}`;
      const now = Date.now();
      const lastAt = lastAlertRef.current.get(dedupeKey);
      if (lastAt !== undefined && now - lastAt < ALERT_DEDUPE_MS) return;
      lastAlertRef.current.set(dedupeKey, now);

      setAlerts((current) =>
        [
          {
            id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
            severity,
            message,
            timestamp: now,
            subsystem,
          },
          ...current,
        ].slice(0, MAX_ALERTS),
      );
    },
    [],
  );

  const applySnapshotSeverity = useCallback(
    (latencyMs: number | null, consecutiveFailures: number, fatal = false) => {
      if (mockedSeverityRef.current !== null) return;

      const nextSeverity = severityFromSnapshotMetrics(
        latencyMs,
        consecutiveFailures,
        fatal,
      );
      setSnapshotSeverity(nextSeverity);

      if (latencyMs !== null && latencyMs > 500) {
        setSnapshotPollIntervalMs(
          latencyMs > 1_000 ? SNAPSHOT_POLL_CRITICAL_MS : SNAPSHOT_POLL_SLOW_MS,
        );
      } else if (nextSeverity === "GREEN" || nextSeverity === "YELLOW") {
        setSnapshotPollIntervalMs(SNAPSHOT_POLL_NORMAL_MS);
      }

      const freeze = nextSeverity === "ORANGE" || severityIsCritical(nextSeverity);
      setPollingFrozen(freeze);

      if (shouldAutoEnableSafeMode(nextSeverity)) {
        setAutoSafeMode(true);
        pushAlert("PARABLE Safe Mode engaged — non-essential polling frozen.", "RED", "snapshot");
      }

      setSubsystems((current) =>
        updateSubsystem(current, "snapshot", {
          severity: nextSeverity,
          latencyMs,
          consecutiveFailures,
          message:
            nextSeverity === "GREEN"
              ? null
              : fatal
                ? "Snapshot pipeline blocked."
                : consecutiveFailures > 0
                  ? "Snapshot failures detected."
                  : "Snapshot slow — auto-throttling enabled.",
        }),
      );
    },
    [pushAlert],
  );

  const reportSnapshotSuccess = useCallback(
    (store: ProductionStore, latencyMs: number) => {
      if (mockedSeverityRef.current !== null) return;

      snapshotFailureStreakRef.current = 0;
      setUsingCachedSnapshot(false);
      setLastSnapshotSuccessAt(Date.now());
      saveLastKnownSnapshot(store);

      if (latencyMs > 500) {
        pushAlert("Snapshot slow — auto-throttling enabled.", "YELLOW", "snapshot");
      }

      applySnapshotSeverity(latencyMs, 0, false);

      setSubsystems((current) =>
        updateSubsystem(current, "snapshot", {
          severity:
            latencyMs > 1_000 ? "ORANGE" : latencyMs > 500 ? "YELLOW" : "GREEN",
          latencyMs,
          consecutiveFailures: 0,
          lastSuccessAt: Date.now(),
          successRate: computeSuccessRate(current.snapshot.successRate, "success"),
          isolated: false,
          message: null,
        }),
      );

      setSubsystems((current) =>
        updateSubsystem(current, "stream", {
          severity: store.production.isLive ? "GREEN" : "GREEN",
          lastSuccessAt: Date.now(),
          successRate: computeSuccessRate(current.stream.successRate, "success"),
          message: store.production.isLive ? "Stream live." : "Stream standby.",
        }),
      );
    },
    [applySnapshotSeverity, pushAlert],
  );

  const reportSnapshotFailure = useCallback(
    (error: unknown) => {
      if (mockedSeverityRef.current !== null) return;

      snapshotFailureStreakRef.current += 1;
      setUsingCachedSnapshot(true);
      pushAlert("Using cached broadcast state.", "ORANGE", "snapshot");

      const failures = snapshotFailureStreakRef.current;
      applySnapshotSeverity(null, failures, failures >= 5);

      setSubsystems((current) =>
        updateSubsystem(current, "snapshot", {
          consecutiveFailures: failures,
          successRate: computeSuccessRate(current.snapshot.successRate, "failure"),
          message:
            error instanceof Error ? error.message : "Snapshot refresh failed.",
        }),
      );
    },
    [applySnapshotSeverity, pushAlert],
  );

  const reportSubsystemOutcome = useCallback(
    (id: SubsystemId, outcome: SubsystemOutcome, latencyMs?: number, message?: string) => {
      setSubsystems((current) => {
        const previous = current[id];
        const consecutiveFailures =
          outcome === "failure" ? previous.consecutiveFailures + 1 : 0;
        const severity: HealthSeverity =
          outcome === "failure"
            ? consecutiveFailures >= 3
              ? "RED"
              : "ORANGE"
            : latencyMs !== undefined && latencyMs > 500
              ? "YELLOW"
              : "GREEN";

        return updateSubsystem(current, id, {
          severity,
          latencyMs: latencyMs ?? previous.latencyMs,
          consecutiveFailures,
          lastSuccessAt: outcome === "success" ? Date.now() : previous.lastSuccessAt,
          successRate: computeSuccessRate(previous.successRate, outcome),
          message: message ?? previous.message,
        });
      });
    },
    [],
  );

  const isolateSubsystem = useCallback(
    (id: SubsystemId, message: string) => {
      setSubsystems((current) =>
        updateSubsystem(current, id, {
          isolated: true,
          severity: "RED",
          message,
        }),
      );
      pushAlert(`${message}`, "ORANGE", id);
    },
    [pushAlert],
  );

  const restoreSubsystem = useCallback((id: SubsystemId) => {
    setSubsystems((current) =>
      updateSubsystem(current, id, {
        isolated: false,
        severity: "GREEN",
        consecutiveFailures: 0,
        message: null,
      }),
    );
  }, []);

  const isSubsystemIsolated = useCallback(
    (id: SubsystemId) => subsystems[id]?.isolated === true,
    [subsystems],
  );

  const safeMode = safeModeManual || autoSafeMode;

  const calculatedSeverity = useMemo(() => {
    const subsystemSeverity = aggregateSeverity(Object.values(subsystems));
    return maxSeverity(subsystemSeverity, snapshotSeverity);
  }, [snapshotSeverity, subsystems]);

  const severity = mockedSeverity ?? calculatedSeverity;

  const shouldFreezePolling = useCallback(() => {
    if (mockedSeverity === "ORANGE" || mockedSeverity === "RED" || mockedSeverity === "BLACK") {
      return true;
    }
    if (mockedSeverity === "GREEN" || mockedSeverity === "YELLOW") {
      return false;
    }
    return safeMode || pollingFrozen;
  }, [mockedSeverity, pollingFrozen, safeMode]);

  const shouldAllowRealtime = useCallback(() => {
    if (mockedSeverity === "RED" || mockedSeverity === "BLACK") return false;
    if (mockedSeverity === "ORANGE") return false;
    return !safeMode;
  }, [mockedSeverity, safeMode]);

  const guardCommand = useCallback(
    (action: string, extras?: Record<string, unknown>, confirmed = false) =>
      commandGuardRef.current.guard(action, extras, confirmed),
    [],
  );

  const recordCommandOutcome = useCallback(
    (action: string, outcome: Exclude<CommandOutcome, "pending">, message?: string) => {
      commandGuardRef.current.recordOutcome(action, outcome, message);
      reportSubsystemOutcome(
        "command",
        outcome === "success" ? "success" : "failure",
        undefined,
        message,
      );
    },
    [reportSubsystemOutcome],
  );

  const requiresCommandConfirmation = useCallback(
    (action: string) =>
      commandGuardRef.current.requiresConfirmation(
        action,
        safeMode,
        severityIsCritical(severity),
      ),
    [safeMode, severity],
  );

  const persistCountdownConfig = useCallback((config: EventCountdownConfig) => {
    saveLastKnownCountdown(config);
    reportSubsystemOutcome("countdown", "success");
  }, [reportSubsystemOutcome]);

  const resolveSnapshotPollInterval = useCallback(() => {
    if (mockedSeverity === "YELLOW") return SNAPSHOT_POLL_SLOW_MS;
    if (
      mockedSeverity === "ORANGE" ||
      mockedSeverity === "RED" ||
      mockedSeverity === "BLACK"
    ) {
      return SNAPSHOT_POLL_CRITICAL_MS;
    }
    if (mockedSeverity === "GREEN") return SNAPSHOT_POLL_NORMAL_MS;
    if (shouldFreezePolling()) return SNAPSHOT_POLL_CRITICAL_MS;
    return snapshotPollIntervalMs;
  }, [mockedSeverity, shouldFreezePolling, snapshotPollIntervalMs]);

  const mockSimulateSeverity = useCallback(
    (level: HealthSeverity | null) => {
      const drillSubsystems: SubsystemId[] = [
        "fellowship_chat",
        "polls",
        "seeds",
        "countdown",
        "giving",
      ];

      if (level === null) {
        setMockedSeverity(null);
        setPollingFrozen(false);
        setUsingCachedSnapshot(false);
        setSnapshotPollIntervalMs(SNAPSHOT_POLL_NORMAL_MS);
        setAutoSafeMode(false);
        for (const id of drillSubsystems) {
          restoreSubsystem(id);
        }
        pushAlert("Drill simulator reset — live health metrics restored.", "GREEN");
        return;
      }

      setMockedSeverity(level);
      setSnapshotSeverity(level);

      switch (level) {
        case "GREEN":
          setSnapshotPollIntervalMs(SNAPSHOT_POLL_NORMAL_MS);
          setPollingFrozen(false);
          setUsingCachedSnapshot(false);
          setAutoSafeMode(false);
          for (const id of drillSubsystems) {
            restoreSubsystem(id);
          }
          pushAlert("Drill: GREEN stable — normal polling restored.", "GREEN", "snapshot");
          break;
        case "YELLOW":
          setSnapshotPollIntervalMs(SNAPSHOT_POLL_SLOW_MS);
          setPollingFrozen(false);
          setUsingCachedSnapshot(false);
          setAutoSafeMode(false);
          for (const id of drillSubsystems) {
            restoreSubsystem(id);
          }
          pushAlert("Drill: YELLOW latency — snapshot polling slowed to 5s.", "YELLOW", "snapshot");
          break;
        case "ORANGE":
          setSnapshotPollIntervalMs(SNAPSHOT_POLL_CRITICAL_MS);
          setPollingFrozen(true);
          setUsingCachedSnapshot(true);
          setAutoSafeMode(false);
          for (const id of drillSubsystems) {
            restoreSubsystem(id);
          }
          pushAlert(
            "Drill: ORANGE lag — polling frozen, serving cached broadcast state.",
            "ORANGE",
            "snapshot",
          );
          break;
        case "RED":
        case "BLACK":
          setSnapshotPollIntervalMs(SNAPSHOT_POLL_CRITICAL_MS);
          setPollingFrozen(true);
          setUsingCachedSnapshot(true);
          setAutoSafeMode(true);
          for (const id of drillSubsystems) {
            isolateSubsystem(
              id,
              `${telemetrySubsystemLabel(id)} isolated by drill simulator.`,
            );
          }
          pushAlert(
            `Drill: ${level} failure — Safe Mode engaged, subsystems isolated.`,
            level,
            "snapshot",
          );
          break;
        default:
          break;
      }
    },
    [isolateSubsystem, pushAlert, restoreSubsystem],
  );

  const updateSystemHealth = useCallback(
    (metrics: SystemHealthMetrics) => {
      if (mockedSeverityRef.current !== null) return;

      const latencyMs = Math.round(metrics.latency);
      const subsystem = isSubsystemId(metrics.subsystem) ? metrics.subsystem : undefined;
      if (!subsystem) return;

      if (subsystem === "snapshot") {
        if (metrics.failed) {
          setSubsystems((current) =>
            updateSubsystem(current, "snapshot", {
              latencyMs,
              message: "Snapshot request failed.",
            }),
          );
          return;
        }

        applySnapshotSeverity(latencyMs, snapshotFailureStreakRef.current, false);
        reportSubsystemOutcome("snapshot", "success", latencyMs);
        return;
      }

      if (metrics.failed) {
        reportSubsystemOutcome(subsystem, "failure", latencyMs);
        if (subsystem !== "command" && subsystem !== "stream") {
          isolateSubsystem(
            subsystem,
            `${telemetrySubsystemLabel(subsystem)} paused to protect live stream.`,
          );
        }
        return;
      }

      reportSubsystemOutcome(subsystem, "success", latencyMs);
    },
    [applySnapshotSeverity, isolateSubsystem, reportSubsystemOutcome],
  );

  useEffect(() => {
    registerParableHealthUpdater(updateSystemHealth);
    return () => unregisterParableHealthUpdater();
  }, [updateSystemHealth]);

  const value = useMemo<BroadcastHealthContextValue>(
    () => ({
      surface,
      severity,
      safeMode,
      safeModeManual,
      subsystems,
      alerts,
      commandLog: commandGuardRef.current.getLog(),
      lastSnapshotSuccessAt,
      snapshotPollIntervalMs,
      pollingFrozen,
      usingCachedSnapshot,
      pushAlert,
      clearAlerts: () => setAlerts([]),
      setSafeModeManual: (enabled: boolean) => {
        setSafeModeManualState(enabled);
        if (!enabled && !severityIsCritical(severity)) {
          setAutoSafeMode(false);
        }
        pushAlert(
          enabled
            ? "Operator enabled PARABLE Safe Mode."
            : "Operator disabled manual Safe Mode.",
          enabled ? "ORANGE" : "GREEN",
        );
      },
      reportSnapshotSuccess,
      reportSnapshotFailure,
      reportSubsystemOutcome,
      isolateSubsystem,
      restoreSubsystem,
      isSubsystemIsolated,
      shouldFreezePolling,
      shouldAllowRealtime,
      guardCommand,
      recordCommandOutcome,
      requiresCommandConfirmation,
      persistCountdownConfig,
      getCommandLog: () => commandGuardRef.current.getLog(),
      resolveSnapshotPollInterval,
      updateSystemHealth,
      isMocked,
      mockSimulateSeverity,
    }),
    [
      alerts,
      guardCommand,
      isolateSubsystem,
      isMocked,
      isSubsystemIsolated,
      lastSnapshotSuccessAt,
      mockSimulateSeverity,
      persistCountdownConfig,
      pollingFrozen,
      pushAlert,
      reportSnapshotFailure,
      reportSnapshotSuccess,
      reportSubsystemOutcome,
      requiresCommandConfirmation,
      recordCommandOutcome,
      resolveSnapshotPollInterval,
      restoreSubsystem,
      safeMode,
      safeModeManual,
      severity,
      shouldAllowRealtime,
      shouldFreezePolling,
      snapshotPollIntervalMs,
      subsystems,
      surface,
      updateSystemHealth,
      usingCachedSnapshot,
    ],
  );

  return (
    <BroadcastHealthContext.Provider value={value}>
      {children}
    </BroadcastHealthContext.Provider>
  );
}

export function useBroadcastHealth(): BroadcastHealthContextValue {
  return useContext(BroadcastHealthContext);
}

export type { BroadcastHealthContextValue };
export type { HealthSeverity as SeverityLevel } from "@/lib/parable/health-types";

function telemetrySubsystemLabel(id: SubsystemId): string {
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
