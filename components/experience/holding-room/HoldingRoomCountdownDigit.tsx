"use client";

import { useEffect, useRef, useState } from "react";

type HoldingRoomCountdownDigitProps = {
  value: string;
  unitClass: string;
};

/** Neon tick pulse when a unit value changes (odometer-style feedback). */
export default function HoldingRoomCountdownDigit({ value, unitClass }: HoldingRoomCountdownDigitProps) {
  const [isTicking, setIsTicking] = useState(false);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (previousValueRef.current === value) return;
    previousValueRef.current = value;
    setIsTicking(true);
    const timeoutId = window.setTimeout(() => setIsTicking(false), 480);
    return () => window.clearTimeout(timeoutId);
  }, [value]);

  return (
    <div
      className={[
        "holding-room-countdown__value",
        "font-headline",
        unitClass,
        isTicking ? "holding-room-countdown__value--tick" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="holding-room-countdown__value-inner" suppressHydrationWarning>
        {value}
      </span>
    </div>
  );
}
