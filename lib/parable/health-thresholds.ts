/** Snapshot latency crosses YELLOW when above this threshold. */
export const SNAPSHOT_LATENCY_YELLOW_MS = 500;

/** Snapshot latency crosses ORANGE when above this threshold. */
export const SNAPSHOT_LATENCY_ORANGE_MS = 1_000;

/** Consecutive snapshot failures before RED. */
export const SNAPSHOT_CONSECUTIVE_FAILURE_RED = 3;

/** Block duplicate operator commands within this window. */
export const COMMAND_DEBOUNCE_MS = 2_000;

export const SNAPSHOT_POLL_NORMAL_MS = 2_500;
export const SNAPSHOT_POLL_SLOW_MS = 5_000;
export const SNAPSHOT_POLL_CRITICAL_MS = 10_000;

export const DESTRUCTIVE_COMMANDS = new Set(["stop_live", "go_live"]);
export const ALWAYS_CONFIRM_COMMANDS = new Set(["stop_live"]);

export const MAX_ALERTS = 12;
export const MAX_COMMAND_LOG = 40;
export const SUBSYSTEM_SUCCESS_WINDOW = 20;
export const ALERT_DEDUPE_MS = 30_000;
