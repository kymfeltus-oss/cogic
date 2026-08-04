export type HealthSeverity = "GREEN" | "YELLOW" | "ORANGE" | "RED" | "BLACK";
export type ProductionStore = {
  production: {
    isLive: boolean;
  };
} & Record<string, unknown>;

/** Alias used by telemetry layer and operator dashboards. */
export type SeverityLevel = HealthSeverity;

export type ParableSurface = "broadcast" | "experience";

export type SubsystemId =
  | "snapshot"
  | "command"
  | "stream"
  | "countdown"
  | "fellowship_chat"
  | "polls"
  | "seeds"
  | "giving";

const SUBSYSTEM_IDS = new Set<SubsystemId>([
  "snapshot",
  "command",
  "stream",
  "countdown",
  "fellowship_chat",
  "polls",
  "seeds",
  "giving",
]);

export function isSubsystemId(value: string | undefined): value is SubsystemId {
  return value !== undefined && SUBSYSTEM_IDS.has(value as SubsystemId);
}

export type SubsystemHealth = {
  id: SubsystemId;
  severity: HealthSeverity;
  latencyMs: number | null;
  successRate: number;
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  isolated: boolean;
  message: string | null;
};

export type HealthAlert = {
  id: string;
  severity: HealthSeverity;
  message: string;
  timestamp: number;
  subsystem?: SubsystemId;
};

export type CommandOutcome = "success" | "blocked" | "error" | "pending";

export type CommandLogEntry = {
  timestamp: number;
  action: string;
  outcome: CommandOutcome;
  message?: string;
};

export type CommandGuardResult = {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
};

export type BroadcastHealthSnapshot = {
  severity: HealthSeverity;
  safeMode: boolean;
  safeModeManual: boolean;
  subsystems: Record<SubsystemId, SubsystemHealth>;
  alerts: HealthAlert[];
  commandLog: CommandLogEntry[];
  lastSnapshotSuccessAt: number | null;
  snapshotPollIntervalMs: number;
  pollingFrozen: boolean;
  usingCachedSnapshot: boolean;
};

export type SnapshotSuccessPayload = {
  store: ProductionStore;
  latencyMs: number;
};

export function createDefaultSubsystem(id: SubsystemId): SubsystemHealth {
  return {
    id,
    severity: "GREEN",
    latencyMs: null,
    successRate: 1,
    consecutiveFailures: 0,
    lastSuccessAt: null,
    isolated: false,
    message: null,
  };
}

export function createInitialSubsystems(): Record<SubsystemId, SubsystemHealth> {
  return {
    snapshot: createDefaultSubsystem("snapshot"),
    command: createDefaultSubsystem("command"),
    stream: createDefaultSubsystem("stream"),
    countdown: createDefaultSubsystem("countdown"),
    fellowship_chat: createDefaultSubsystem("fellowship_chat"),
    polls: createDefaultSubsystem("polls"),
    seeds: createDefaultSubsystem("seeds"),
    giving: createDefaultSubsystem("giving"),
  };
}
