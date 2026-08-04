import {
  getParableHealthUpdater,
} from "@/lib/telemetry/healthBridge";
import {
  parableFetch as executeParableFetch,
  type ParableFetchOptions,
} from "@/lib/telemetry/parableFetch";
import type { SubsystemId } from "@/lib/parable/health-types";

export type { ParableFetchOptions } from "@/lib/telemetry/parableFetch";

export type ParableFetchResult = {
  response: Response;
  latencyMs: number;
};

type LegacyParableFetchOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
  subsystem?: SubsystemId;
};

/**
 * Hook-friendly PARABLE fetch — routes latency metrics through the health bridge
 * registered by BroadcastHealthProvider.
 */
export async function parableFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: LegacyParableFetchOptions = {},
): Promise<ParableFetchResult> {
  const url = typeof input === "string" ? input : input.toString();
  const timeoutMs = options.timeoutMs ?? 12_000;
  const signal = options.signal ?? init.signal ?? undefined;

  const { response, latency } = await executeParableFetch(
    url,
    {
      ...init,
      subsystem: options.subsystem,
      timeoutMs,
      signal,
    },
    getParableHealthUpdater(),
  );

  return {
    response,
    latencyMs: Math.round(latency),
  };
}
