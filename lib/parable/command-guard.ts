import {
  ALWAYS_CONFIRM_COMMANDS,
  COMMAND_DEBOUNCE_MS,
  DESTRUCTIVE_COMMANDS,
  MAX_COMMAND_LOG,
} from "@/lib/parable/health-thresholds";
import type { CommandGuardResult, CommandLogEntry, CommandOutcome } from "@/lib/parable/health-types";

function commandFingerprint(action: string, extras?: Record<string, unknown>): string {
  const sourceId = typeof extras?.sourceId === "string" ? extras.sourceId : "";
  const transition = typeof extras?.transition === "string" ? extras.transition : "";
  return `${action}:${sourceId}:${transition}`;
}

export class ParableCommandGuard {
  private lastExecutedAt = new Map<string, number>();
  private log: CommandLogEntry[] = [];

  guard(action: string, extras?: Record<string, unknown>, confirmed = false): CommandGuardResult {
    const fingerprint = commandFingerprint(action, extras);
    const now = Date.now();
    const lastAt = this.lastExecutedAt.get(fingerprint);

    if (lastAt !== undefined && now - lastAt < COMMAND_DEBOUNCE_MS) {
      const message = `Duplicate "${action}" blocked — wait ${COMMAND_DEBOUNCE_MS / 1000}s between commands.`;
      this.appendLog(action, "blocked", message);
      return { allowed: false, reason: message };
    }

    const requiresConfirmation = ALWAYS_CONFIRM_COMMANDS.has(action);

    if (requiresConfirmation && !confirmed) {
      return {
        allowed: false,
        requiresConfirmation: true,
        reason: `Confirmation required for "${action}".`,
      };
    }

    this.lastExecutedAt.set(fingerprint, now);
    this.appendLog(action, "pending");
    return { allowed: true };
  }

  recordOutcome(action: string, outcome: Exclude<CommandOutcome, "pending">, message?: string): void {
    const pendingIndex = this.log.findIndex(
      (entry) => entry.action === action && entry.outcome === "pending",
    );

    if (pendingIndex >= 0) {
      this.log[pendingIndex] = {
        ...this.log[pendingIndex],
        outcome,
        message,
        timestamp: Date.now(),
      };
      return;
    }

    this.appendLog(action, outcome, message);
  }

  getLog(): CommandLogEntry[] {
    return this.log;
  }

  requiresConfirmation(action: string, safeModeActive: boolean, severityIsCritical: boolean): boolean {
    if (ALWAYS_CONFIRM_COMMANDS.has(action)) return true;
    if (!DESTRUCTIVE_COMMANDS.has(action)) return false;
    return safeModeActive || severityIsCritical;
  }

  private appendLog(action: string, outcome: CommandOutcome, message?: string): void {
    this.log = [
      {
        timestamp: Date.now(),
        action,
        outcome,
        message,
      },
      ...this.log,
    ].slice(0, MAX_COMMAND_LOG);
  }
}
