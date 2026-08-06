/** Pre-live holding room — `/public/holding page/holding-room.png` on mobile artboard track. */

export const HOLDING_ROOM_ARTBOARD = {
  width: 1080,
  height: 1920,
} as const;

/** Native PNG plate (926×1698) — top-aligned inside the 1080×1920 stage. */
export const HOLDING_ROOM_ART_NATIVE = {
  width: 926,
  height: 1698,
} as const;

export const HOLDING_ROOM_ASSET_VERSION = "20260621-holding-v7";

export const HOLDING_ROOM_ASSETS = {
  mobileBackground: `/my-sanctuary/banner.png?v=${HOLDING_ROOM_ASSET_VERSION}`,
} as const;
