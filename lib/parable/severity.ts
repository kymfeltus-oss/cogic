import {
  SNAPSHOT_CONSECUTIVE_FAILURE_RED,
  SNAPSHOT_LATENCY_ORANGE_MS,
  SNAPSHOT_LATENCY_YELLOW_MS,
} from "@/lib/parable/health-thresholds";
import type { HealthSeverity, SubsystemHealth } from "@/lib/parable/health-types";

const SEVERITY_RANK: Record<HealthSeverity, number> = {
  GREEN: 0,
  YELLOW: 1,
  ORANGE: 2,
  RED: 3,
  BLACK: 4,
};

export function maxSeverity(a: HealthSeverity, b: HealthSeverity): HealthSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

export function severityFromSnapshotMetrics(
  latencyMs: number | null,
  consecutiveFailures: number,
  fatalError: boolean,
): HealthSeverity {
  if (fatalError) return "BLACK";
  if (consecutiveFailures >= SNAPSHOT_CONSECUTIVE_FAILURE_RED) return "RED";
  if (latencyMs !== null && latencyMs > SNAPSHOT_LATENCY_ORANGE_MS) return "ORANGE";
  if (latencyMs !== null && latencyMs > SNAPSHOT_LATENCY_YELLOW_MS) return "YELLOW";
  if (consecutiveFailures > 0) return "YELLOW";
  return "GREEN";
}

export function aggregateSeverity(subsystems: SubsystemHealth[]): HealthSeverity {
  return subsystems.reduce<HealthSeverity>(
    (current, subsystem) => maxSeverity(current, subsystem.severity),
    "GREEN",
  );
}

export function severityIsCritical(severity: HealthSeverity): boolean {
  return severity === "RED" || severity === "BLACK";
}

export function shouldAutoEnableSafeMode(severity: HealthSeverity): boolean {
  return severityIsCritical(severity);
}

export function snapshotPollIntervalForSeverity(severity: HealthSeverity): number {
  if (severity === "GREEN" || severity === "YELLOW") return 2_000;
  if (severity === "ORANGE") return 5_000;
  return 10_000;
}
