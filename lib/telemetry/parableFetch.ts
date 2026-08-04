import type { SubsystemId } from "@/lib/parable/health-types";

export type SystemHealthMetrics = {
  latency: number;
  subsystem?: string;
  failed: boolean;
};

export type UpdateSystemHealth = (metrics: SystemHealthMetrics) => void;

export interface ParableFetchOptions extends RequestInit {
  subsystem?: SubsystemId | string;
  timeoutMs?: number;
}

export type ParableFetchResult = {
  response: Response;
  latency: number;
};

/**
 * Core PARABLE fetch executor — measures latency and pushes metrics into the
 * global health state machine via the injected updater (registered by
 * BroadcastHealthProvider).
 */
export async function parableFetch(
  url: string,
  options: ParableFetchOptions = {},
  updateSystemHealth: UpdateSystemHealth,
): Promise<ParableFetchResult> {
  const { subsystem, timeoutMs = 4_000, ...nativeOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = performance.now();

  const signals = [controller.signal];
  if (nativeOptions.signal) signals.push(nativeOptions.signal);

  const onAbort = () => controller.abort();
  for (const signal of signals) {
    if (signal.aborted) controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    const response = await fetch(url, {
      ...nativeOptions,
      signal: controller.signal,
    });

    const latency = performance.now() - startTime;
    clearTimeout(timeoutId);

    updateSystemHealth({
      latency,
      subsystem,
      failed: !response.ok,
    });

    return { response, latency };
  } catch (error) {
    clearTimeout(timeoutId);

    const isAbort =
      (error instanceof DOMException || error instanceof Error) &&
      error.name === "AbortError";

    if (!isAbort) {
      updateSystemHealth({
        latency: performance.now() - startTime,
        subsystem,
        failed: true,
      });
    }

    throw error;
  } finally {
    for (const signal of signals) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}
