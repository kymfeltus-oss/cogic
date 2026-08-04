"use client";

import { useEffect, useState } from "react";
import {
  computeEventCountdownPhase,
  type EventCountdownPhase,
} from "@/lib/live/countdown-config";

export function useEventPhase(startTime: string, endTime: string): EventCountdownPhase {
  const [phase, setPhase] = useState<EventCountdownPhase>(() =>
    computeEventCountdownPhase(startTime, endTime),
  );

  useEffect(() => {
    const tick = () => {
      setPhase((previous) => {
        const next = computeEventCountdownPhase(startTime, endTime);
        return previous === next ? previous : next;
      });
    };
    tick();
    const intervalId = window.setInterval(tick, 1_000);
    return () => window.clearInterval(intervalId);
  }, [endTime, startTime]);

  return phase;
}
