export type ActivityKind =
  | "donation"
  | "prayer"
  | "join"
  | "share"
  | "music"
  | "system";

/** Internal only — never surfaced in attendee UI */
export type ActivitySource = "real" | "seeded";

export type LiveActivityItem = {
  id: string;
  kind: ActivityKind;
  source: ActivitySource;
  name: string;
  message: string;
  amount?: number;
  city?: string;
  createdAt: string;
};

export const HYBRID_ACTIVITY_MIN_REAL = 8;
export const HYBRID_ACTIVITY_POOL_SIZE = 18;
export const HYBRID_ACTIVITY_VISIBLE_MAX = 5;

const SEEDED_TEMPLATES: Omit<LiveActivityItem, "id" | "createdAt">[] = [
  {
    kind: "join",
    source: "seeded",
    name: "Sarah M.",
    message: "joined the live room",
  },
  {
    kind: "share",
    source: "seeded",
    name: "Marcus T.",
    message: "shared the event",
  },
  {
    kind: "prayer",
    source: "seeded",
    name: "Elena R.",
    message: "submitted a prayer request",
  },
  {
    kind: "system",
    source: "seeded",
    name: "Worship Team",
    message: "is ready for tonight",
  },
  {
    kind: "donation",
    source: "seeded",
    name: "A viewer",
    message: "opened Vital Seed Giving",
  },
  {
    kind: "join",
    source: "seeded",
    name: "Someone in Dallas",
    message: "entered the lobby",
    city: "Dallas",
  },
  {
    kind: "join",
    source: "seeded",
    name: "A family",
    message: "is watching together",
  },
  {
    kind: "system",
    source: "seeded",
    name: "Choir",
    message: "soundcheck finished",
  },
  {
    kind: "system",
    source: "seeded",
    name: "The community",
    message: "is gathering",
  },
  {
    kind: "donation",
    source: "seeded",
    name: "Someone",
    message: "joined the Awakening Harvest",
  },
  {
    kind: "donation",
    source: "seeded",
    name: "A family",
    message: "is preparing to sow",
  },
  {
    kind: "music",
    source: "seeded",
    name: "A listener",
    message: "opened Hallelujah Anyhow!",
  },
  {
    kind: "share",
    source: "seeded",
    name: "Jordan P.",
    message: "invited friends to tune in",
  },
  {
    kind: "prayer",
    source: "seeded",
    name: "Keisha L.",
    message: "lifted a prayer for breakthrough",
  },
  {
    kind: "join",
    source: "seeded",
    name: "The Rivera family",
    message: "entered the experience",
  },
  {
    kind: "system",
    source: "seeded",
    name: "Main stage",
    message: "rehearsal complete",
  },
  {
    kind: "join",
    source: "seeded",
    name: "A viewer in Atlanta",
    message: "joined the lobby",
    city: "Atlanta",
  },
  {
    kind: "share",
    source: "seeded",
    name: "Chris D.",
    message: "shared the Awakening link",
  },
];

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function buildSeededActivityItems(): LiveActivityItem[] {
  return SEEDED_TEMPLATES.map((template, index) => ({
    ...template,
    id: `seeded-${template.kind}-${index}`,
    createdAt: minutesAgoIso(2 + index * 3),
  }));
}

export function displayNameFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.includes("anonymous")) {
    return "Anonymous";
  }

  const local = normalized.split("@")[0] ?? normalized;
  const parts = local.replace(/[._+-]/g, " ").split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return `${first} ${parts[1].charAt(0).toUpperCase()}.`;
  }

  const single = parts[0] ?? local;
  return single.charAt(0).toUpperCase() + single.slice(1);
}

export function formatActivityTimeAgo(createdAt: string, nowMs = Date.now()): string {
  const deltaMs = Math.max(0, nowMs - new Date(createdAt).getTime());
  const seconds = Math.floor(deltaMs / 1_000);

  if (seconds < 45) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Attendee-safe copy — real donations may include verified amounts only */
export function formatAttendeeActivityMessage(item: LiveActivityItem): string {
  if (item.kind === "donation" && item.source === "real" && typeof item.amount === "number") {
    const dollars = Number.isInteger(item.amount)
      ? item.amount
      : Math.round(item.amount * 100) / 100;
    return `${item.name} sowed $${dollars}`;
  }

  if (item.message.toLowerCase().startsWith(item.name.toLowerCase())) {
    return item.message;
  }

  return `${item.name} ${item.message}`;
}

export function getHybridActivity(realItems: LiveActivityItem[]): LiveActivityItem[] {
  const sortedReal = [...realItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (sortedReal.length >= HYBRID_ACTIVITY_MIN_REAL) {
    return sortedReal.slice(0, HYBRID_ACTIVITY_POOL_SIZE);
  }

  const seeded = buildSeededActivityItems();
  const realKeys = new Set(
    sortedReal.map((item) => `${item.kind}:${item.message.toLowerCase()}`),
  );

  const filler = seeded.filter(
    (item) => !realKeys.has(`${item.kind}:${item.message.toLowerCase()}`),
  );

  const needed = HYBRID_ACTIVITY_POOL_SIZE - sortedReal.length;
  const merged = [...sortedReal, ...filler.slice(0, needed)];

  return merged
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, HYBRID_ACTIVITY_POOL_SIZE);
}

export function sliceVisibleActivity(
  pool: LiveActivityItem[],
  startIndex: number,
  count = HYBRID_ACTIVITY_VISIBLE_MAX,
): LiveActivityItem[] {
  if (pool.length === 0) return [];

  const visible: LiveActivityItem[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i += 1) {
    visible.push(pool[(startIndex + i) % pool.length]);
  }
  return visible;
}

export function filterActivityByKinds(
  items: LiveActivityItem[],
  kinds: ActivityKind[],
): LiveActivityItem[] {
  const allowed = new Set(kinds);
  return items.filter((item) => allowed.has(item.kind));
}
