"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import PublicCountdownDigit from "@/components/countdown/PublicCountdownDigit";
import type { PublicCountdownUnitDef } from "@/lib/countdown/public-countdown-units";

type PublicCountdownUnitProps = {
  unit: PublicCountdownUnitDef;
  value: string;
  index: number;
};

export default function PublicCountdownUnit({ unit, value, index }: PublicCountdownUnitProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (previousValueRef.current === value) return;
    previousValueRef.current = value;
    setIsFlashing(true);
    const timeoutId = window.setTimeout(() => setIsFlashing(false), 520);
    return () => window.clearTimeout(timeoutId);
  }, [value]);

  return (
    <div
      className={[
        "public-countdown-unit",
        isFlashing ? "public-countdown-unit--flash" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--public-countdown-unit-delay": `${index * 0.08}s` } as CSSProperties}
    >
      <div className={`public-countdown-unit__ring ${unit.ringClass}`} aria-hidden="true">
        <div className="public-countdown-unit__ring-glow" aria-hidden="true" />
        <div className="public-countdown-unit__core">
          <PublicCountdownDigit value={value} digitClass={unit.digitClass} />
        </div>
      </div>
      <span className="public-countdown-unit__label font-ui">{unit.label}</span>
    </div>
  );
}
