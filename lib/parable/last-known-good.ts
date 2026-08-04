import type { EventCountdownConfig } from "@/lib/live/countdown-config";
import type { ProductionStore } from "@/lib/parable/health-types";

const SNAPSHOT_KEY = "parable.lkg.snapshot";
const COUNTDOWN_KEY = "parable.lkg.countdown";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota or privacy mode — ignore silently.
  }
}

export function saveLastKnownSnapshot(store: ProductionStore): void {
  writeJson(SNAPSHOT_KEY, store);
}

export function loadLastKnownSnapshot(): ProductionStore | null {
  return readJson<ProductionStore>(SNAPSHOT_KEY);
}

export function saveLastKnownCountdown(config: EventCountdownConfig): void {
  writeJson(COUNTDOWN_KEY, config);
}

export function loadLastKnownCountdown(): EventCountdownConfig | null {
  return readJson<EventCountdownConfig>(COUNTDOWN_KEY);
}
