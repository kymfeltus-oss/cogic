/** Shared pre-live lobby config — replace with API-driven config later. */
export const EVENT_LOBBY = {
  eyebrow: "LIVE RECORDING EXPERIENCE",
  title: "COGIC LIVE",
  venue: "Digital Cathedral · Worldwide Broadcast",
  targetIso: "2026-07-03T19:30:00-05:00",
  streamQualityLabel: "Crystal HD · Secure Feed Ready",
  community: {
    viewersReady: 2847,
    prayersSent: 412,
    shares: 128,
  },
  anticipationFeed: [
    { id: "1", author: "Sarah M.", body: "Ready for worship tonight 🙌" },
    { id: "2", author: "Marcus T.", body: "Bringing my whole family in spirit." },
    { id: "3", author: "Elena R.", body: "Praying for every soul tuning in." },
    { id: "4", author: "Jordan K.", body: "This is going to be historic." },
  ],
  updates: [
    {
      id: "u1",
      label: "Doors Open",
      detail: "Lobby is live — pass holders may enter when signal goes live.",
    },
    {
      id: "u2",
      label: "Experience Layers",
      detail: "Main Stage, Crowd, Musician, and Prayer feeds unlock inside the room.",
    },
  ],
} as const;

export type AccessStatus = "checking" | "verified" | "locked";
export type EventStatus = "waiting" | "live" | "ended";

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isComplete: boolean;
};

export function computeCountdown(targetIso: string, nowMs = Date.now()): CountdownParts {
  const diffMs = new Date(targetIso).getTime() - nowMs;

  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isComplete: true };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, isComplete: false };
}
