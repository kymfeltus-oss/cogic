import type { UpdateSystemHealth } from "@/lib/telemetry/parableFetch";

let activeUpdater: UpdateSystemHealth = () => {};

export function registerParableHealthUpdater(updater: UpdateSystemHealth): void {
  activeUpdater = updater;
}

export function unregisterParableHealthUpdater(): void {
  activeUpdater = () => {};
}

export function getParableHealthUpdater(): UpdateSystemHealth {
  return activeUpdater;
}
