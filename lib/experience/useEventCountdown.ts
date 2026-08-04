"use client";

import { useEffect, useState } from "react";
import { computeCountdown, type CountdownParts } from "@/lib/live/event-lobby";

function countdownPartsEqual(a: CountdownParts, b: CountdownParts): boolean {
  return (
    a.days === b.days &&
    a.hours === b.hours &&
    a.minutes === b.minutes &&
    a.seconds === b.seconds &&
    a.isComplete === b.isComplete
  );
}

export function useEventCountdown(
  targetIso: string,
  serverSnapshot?: CountdownParts,
): CountdownParts {
  const [countdown, setCountdown] = useState<CountdownParts>(
    () => serverSnapshot ?? computeCountdown(targetIso),
  );

  useEffect(() => {
    setCountdown((prev) => {
      const next = computeCountdown(targetIso);
      return countdownPartsEqual(prev, next) ? prev : next;
    });

    const intervalId = window.setInterval(() => {
      setCountdown((prev) => {
        const next = computeCountdown(targetIso);
        return countdownPartsEqual(prev, next) ? prev : next;
      });
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [targetIso]);

  return countdown;
}
