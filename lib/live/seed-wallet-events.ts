export const LIVE_SEED_WALLET_REFRESH_EVENT = "live-seed-wallet-refresh";

export function requestLiveSeedWalletRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LIVE_SEED_WALLET_REFRESH_EVENT));
}
