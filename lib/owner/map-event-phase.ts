import {
  computeEventCountdownPhase,
  DEFAULT_COUNTDOWN_CONFIG,
  type EventCountdownConfig,
} from "@/lib/live/countdown-config";
import { computeEventLifecycleStage } from "@/lib/experience/event-lifecycle";
import type { EventPhase, EventPhaseState } from "@/lib/owner/contracts";

export function mapEventPhaseState(config: EventCountdownConfig): EventPhaseState {
  const startTime = config.start_time?.trim() || null;
  const endTime = config.end_time?.trim() || null;
  const scheduleTimezone = config.schedule_timezone ?? null;

  if (!config.is_active || !startTime || !endTime) {
    return { phase: "idle", startTime, endTime, scheduleTimezone };
  }

  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { phase: "idle", startTime, endTime, scheduleTimezone };
  }

  const scheduleStage = computeEventLifecycleStage(startTime, endTime);
  const countdownPhase = computeEventCountdownPhase(startTime, endTime);

  let phase: EventPhase;
  if (countdownPhase === "ended" || scheduleStage === "ended") {
    phase = "ended";
  } else if (countdownPhase === "live" || scheduleStage === "live") {
    phase = "live";
  } else if (scheduleStage === "holding") {
    phase = "preshow";
  } else if (scheduleStage === "announcement") {
    phase = "scheduled";
  } else {
    phase = "idle";
  }

  return { phase, startTime, endTime, scheduleTimezone };
}

export function defaultEventPhaseState(): EventPhaseState {
  return mapEventPhaseState(DEFAULT_COUNTDOWN_CONFIG);
}
