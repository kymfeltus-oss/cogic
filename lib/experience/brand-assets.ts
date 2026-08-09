/**
 * Public experience brand asset paths.
 * Historical awakening filenames may remain on disk when unrouted;
 * attendee-facing chrome should prefer COGIC LIVE text brand /
 * official Convocation assets when available.
 */

export const EXPERIENCE_BRAND_ASSETS = {
  lockup: "/images/logo.png",
  wordmark: "/images/logo.png",
  logo: "/images/logo.png",
  emblem: "/images/logo.png",
  countdownFrame: "/ui/countdown-frame.png",
} as const;

export type ExperienceBrandAssetKey = keyof typeof EXPERIENCE_BRAND_ASSETS;
