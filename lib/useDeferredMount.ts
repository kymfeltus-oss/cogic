"use client";

import { useEffect, useState } from "react";

type UseDeferredMountOptions = {
  /** Max wait before mounting deferred UI even if the main thread stays busy. */
  timeoutMs?: number;
};

/**
 * Defers non-critical UI until the browser is idle so hero/LCP can paint first.
 */
export function useDeferredMount({ timeoutMs = 1_500 }: UseDeferredMountOptions = {}): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(() => setMounted(true), { timeout: timeoutMs });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(() => setMounted(true), 1);
    return () => window.clearTimeout(timeoutId);
  }, [timeoutMs]);

  return mounted;
}
