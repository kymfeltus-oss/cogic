import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";

/** Attendee home / dashboard close target for fullscreen live. */
export const LIVE_STREAM_CLOSE_PATH = ATTENDEE_DASHBOARD_PATH;

export function buildLiveStreamPath(streamId: string): string {
  return `/live/${encodeURIComponent(streamId)}`;
}

export function buildSeedsHubPath(streamId: string): string {
  const params = new URLSearchParams({ streamId });
  return `/seeds?${params.toString()}`;
}

export type SeedPackageId = "100" | "300" | "600" | "1200";

export function buildSeedsCheckoutPath(streamId: string, packageId: SeedPackageId): string {
  const params = new URLSearchParams({
    streamId,
    package: packageId,
  });
  return `/seeds/checkout?${params.toString()}`;
}

export const SEED_PACKAGES = [
  { id: "100" as const, seeds: 100, priceLabel: "$1.99" },
  { id: "300" as const, seeds: 300, priceLabel: "$4.99" },
  { id: "600" as const, seeds: 600, priceLabel: "$8.99" },
  { id: "1200" as const, seeds: 1200, priceLabel: "$15.99" },
] as const;
