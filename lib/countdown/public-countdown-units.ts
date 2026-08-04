import type { CountdownParts } from "@/lib/live/event-lobby";

export type PublicCountdownUnitId = "days" | "hours" | "minutes" | "seconds";

export type PublicCountdownUnitDef = {
  id: PublicCountdownUnitId;
  label: string;
  ringClass: string;
  digitClass: string;
};

export const PUBLIC_COUNTDOWN_UNITS: readonly PublicCountdownUnitDef[] = [
  {
    id: "days",
    label: "Days",
    ringClass: "public-countdown-unit__ring--days",
    digitClass: "public-countdown-unit__digit--days",
  },
  {
    id: "hours",
    label: "Hours",
    ringClass: "public-countdown-unit__ring--hours",
    digitClass: "public-countdown-unit__digit--hours",
  },
  {
    id: "minutes",
    label: "Minutes",
    ringClass: "public-countdown-unit__ring--minutes",
    digitClass: "public-countdown-unit__digit--minutes",
  },
  {
    id: "seconds",
    label: "Seconds",
    ringClass: "public-countdown-unit__ring--seconds",
    digitClass: "public-countdown-unit__digit--seconds",
  },
] as const;

export function padCountdownUnit(value: number): string {
  return String(Math.max(0, value)).padStart(2, "0");
}

export function resolvePublicCountdownValues(
  countdown: CountdownParts,
  showDays: boolean,
): Record<PublicCountdownUnitId, string> {
  if (!showDays) {
    return {
      days: "00",
      hours: padCountdownUnit(countdown.hours),
      minutes: padCountdownUnit(countdown.minutes),
      seconds: padCountdownUnit(countdown.seconds),
    };
  }

  return {
    days: padCountdownUnit(countdown.days),
    hours: padCountdownUnit(countdown.hours),
    minutes: padCountdownUnit(countdown.minutes),
    seconds: padCountdownUnit(countdown.seconds),
  };
}

export function publicCountdownUnitsForDisplay(
  showDays: boolean,
): readonly PublicCountdownUnitDef[] {
  if (showDays) return PUBLIC_COUNTDOWN_UNITS;
  return PUBLIC_COUNTDOWN_UNITS.filter((unit) => unit.id !== "days");
}
