/** Chicago-local greeting for the attendee dashboard (no fabricated personalization). */

export function chicagoDayGreeting(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function greetingName(firstName: string | null | undefined): string | null {
  const trimmed = firstName?.trim();
  if (!trimmed || trimmed.toLowerCase() === "guest") return null;
  return trimmed;
}
