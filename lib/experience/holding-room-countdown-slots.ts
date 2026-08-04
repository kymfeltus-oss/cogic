/** Percentage rects on holding-room.png (926×1698) — label + digit overlays. */

import {
  alignHoldingRoomCountdownMasks,
  measureHoldingRoomCountdownCentering,
} from "@/lib/experience/holding-room-countdown-circles";

export type HoldingRoomCountdownUnitId = "days" | "hours" | "minutes" | "seconds";

export type HoldingRoomCountdownRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type HoldingRoomCountdownDigitSlot = {
  id: HoldingRoomCountdownUnitId;
  /** Live unit label — masks baked PNG text above each digit column. */
  label: string;
  /** Move label words (DAYS / HOURS / MINS / SECS) — increase `top` to move down. */
  labelMask: HoldingRoomCountdownRect;
  /** Masks baked placeholder digits — live "00" is flex-centered inside this box. */
  valueMask: HoldingRoomCountdownRect;
};

/**
 * PNG is height-fit inside the 1080×1920 stage (top-aligned, side letterbox).
 * Map PNG percentage coords → overlay percentage coords on the art-fit box.
 */
export const HOLDING_ROOM_PNG_STAGE = {
  widthRatio: (926 * 1920) / (1698 * 1080),
  xOffset: ((1 - (926 * 1920) / (1698 * 1080)) / 2) * 100,
} as const;

export function holdingRoomStageX(pngPercentX: number): number {
  return HOLDING_ROOM_PNG_STAGE.xOffset + pngPercentX * HOLDING_ROOM_PNG_STAGE.widthRatio;
}

/** Height-fit plate — PNG Y maps 1:1 to the stage art-fit box. */
export function holdingRoomStageY(pngPercentY: number): number {
  return pngPercentY;
}

export function holdingRoomStageRect(rect: HoldingRoomCountdownRect): HoldingRoomCountdownRect {
  return {
    left: holdingRoomStageX(rect.left),
    top: holdingRoomStageY(rect.top),
    width: rect.width * HOLDING_ROOM_PNG_STAGE.widthRatio,
    height: rect.height,
  };
}

const HOLDING_ROOM_COUNTDOWN_LABELS: Record<HoldingRoomCountdownUnitId, string> = {
  days: "DAYS",
  hours: "HOURS",
  minutes: "MINS",
  seconds: "SECS",
};

const HOLDING_ROOM_COUNTDOWN_ORDER: HoldingRoomCountdownUnitId[] = [
  "days",
  "hours",
  "minutes",
  "seconds",
];

/** Days anchor centering applied to all four PNG circle columns. */
export const HOLDING_ROOM_COUNTDOWN_CENTERING = measureHoldingRoomCountdownCentering();

const ALIGNED_HOLDING_ROOM_COUNTDOWN_MASKS = alignHoldingRoomCountdownMasks(
  undefined,
  HOLDING_ROOM_COUNTDOWN_CENTERING,
);

/**
 * Overlay slots derived from the far-left circle anchor.
 * Tune days masks in `HOLDING_ROOM_COUNTDOWN_ANCHOR_MASKS` — other columns follow automatically.
 */
export const HOLDING_ROOM_COUNTDOWN_UNITS: readonly HoldingRoomCountdownDigitSlot[] =
  HOLDING_ROOM_COUNTDOWN_ORDER.map((id) => ({
    id,
    label: HOLDING_ROOM_COUNTDOWN_LABELS[id],
    ...ALIGNED_HOLDING_ROOM_COUNTDOWN_MASKS[id],
  }));

export const HOLDING_ROOM_COUNTDOWN_VALUE_CLASS: Record<HoldingRoomCountdownUnitId, string> = {
  days: "holding-room-countdown__value--days",
  hours: "holding-room-countdown__value--hours",
  minutes: "holding-room-countdown__value--minutes",
  seconds: "holding-room-countdown__value--seconds",
};
