"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientAppUrl } from "@/lib/client-api";
import { EXPERIENCE_LIVE_PATH } from "@/lib/experience/live-routes";
import { useLiveSeedWallet } from "@/lib/useLiveSeedWallet";

const BUY_SEEDS_PATH = "/buy-seeds";

type UseIanCraigLiveSeedActionsOptions = {
  /** Opens the in-stream giving sheet when sow requires a purchase top-up. */
  onOpenGiveSheet?: () => void;
};

/**
 * Live seed wallet + monetization handlers for Ian Craig LIVE.
 * - `handleAddSeeds` → `/buy-seeds` (Stripe packs credit `seed_wallets`)
 * - `handleSowSeed` → POST `/api/live/seeds/sow` (free taps, then 1 seed each)
 */
export function useIanCraigLiveSeedActions({
  onOpenGiveSheet,
}: UseIanCraigLiveSeedActionsOptions = {}) {
  const router = useRouter();
  const wallet = useLiveSeedWallet();
  const [isSowing, setIsSowing] = useState(false);
  const [sowError, setSowError] = useState<string | null>(null);

  const handleAddSeeds = useCallback(() => {
    const params = new URLSearchParams({ from: EXPERIENCE_LIVE_PATH });
    router.push(`${BUY_SEEDS_PATH}?${params.toString()}`);
  }, [router]);

  const handleSowSeed = useCallback(async () => {
    setIsSowing(true);
    setSowError(null);

    try {
      const response = await fetch(`${getClientAppUrl()}/api/live/seeds/sow`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      const data = (await response.json()) as {
        balance?: number;
        usedFreeTaps?: number;
        error?: string;
      };

      if (response.status === 401) {
        setSowError("Sign in to sow a seed.");
        return;
      }

      if (response.status === 402) {
        setSowError(data.error ?? "Buy more seeds to keep sowing.");
        handleAddSeeds();
        return;
      }

      if (!response.ok) {
        setSowError(data.error ?? "Unable to sow a seed.");
        return;
      }

      if (typeof data.balance === "number") {
        wallet.setBalance(data.balance);
      }

      if (typeof data.usedFreeTaps === "number") {
        wallet.setUsedFreeTaps(data.usedFreeTaps);
      }

      await wallet.refresh();
    } catch {
      setSowError("Unable to reach the sow service.");
    } finally {
      setIsSowing(false);
    }
  }, [handleAddSeeds, wallet]);

  const refreshAfterGive = useCallback(() => {
    void wallet.refresh();
  }, [wallet]);

  return {
    balance: wallet.balance,
    usedFreeTaps: wallet.usedFreeTaps,
    isLoading: wallet.isLoading,
    isSowing,
    error: wallet.error,
    sowError,
    clearSowError: () => setSowError(null),
    refresh: wallet.refresh,
    handleAddSeeds,
    handleSowSeed,
    refreshAfterGive,
    openGiveSheet: onOpenGiveSheet,
  };
}

export type IanCraigLiveSeedActions = ReturnType<typeof useIanCraigLiveSeedActions>;
