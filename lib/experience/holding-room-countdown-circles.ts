/** Measured neon ring ovals on `public/holding page/holding-room.png` (926×1698). */

import type { HoldingRoomCountdownRect, HoldingRoomCountdownUnitId } from "@/lib/experience/holding-room-countdown-slots";

export type HoldingRoomCountdownCircle = {
  id: HoldingRoomCountdownUnitId;
  /** Circle center — PNG percentage coords. */
  cx: number;
  cy: number;
  /** Neon oval bounding box — PNG percentage coords. */
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Ring geometry per column (auto-measured on holding-room.png). */
export const HOLDING_ROOM_COUNTDOWN_CIRCLES: readonly HoldingRoomCountdownCircle[] = [
  { id: "days", cx: 13.39, cy: 50.44, left: 5.4, top: 42.99, width: 15.98, height: 14.9 },
  { id: "hours", cx: 37.42, cy: 50.82, left: 29.48, top: 43.76, width: 15.87, height: 14.13 },
  { id: "minutes", cx: 60.42, cy: 50.82, left: 52.48, top: 43.76, width: 15.87, height: 14.13 },
  { id: "seconds", cx: 84.4, cy: 50.44, left: 76.46, top: 42.99, width: 15.87, height: 14.9 },
] as const;

export type HoldingRoomCountdownAnchorMasks = {
  valueMask: HoldingRoomCountdownRect;
  labelMask: HoldingRoomCountdownRect;
};

/** Tuned anchor overlays for the far-left (days) bubble — other columns inherit its centering. */
export const HOLDING_ROOM_COUNTDOWN_ANCHOR_MASKS: HoldingRoomCountdownAnchorMasks = {
  valueMask: { left: 8.4, top: 48.5, width: 12.8, height: 9.2 },
  labelMask: { left: 8.4, top: 54.4, width: 13.0, height: 3.5 },
};

export type HoldingRoomCountdownCentering = {
  /** Mask center minus circle center (PNG %). */
  valueCenterOffsetX: number;
  valueCenterOffsetY: number;
  /** Mask size as a fraction of circle bbox. */
  valueWidthRatio: number;
  valueHeightRatio: number;
  /** Label top minus value top (PNG %). */
  labelTopGap: number;
  labelWidthRatio: number;
  labelHeight: number;
};

function rectCenter(rect: HoldingRoomCountdownRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Derive how the days masks sit inside the first circle (width, height, and center offsets). */
export function measureHoldingRoomCountdownCentering(
  anchorCircle: HoldingRoomCountdownCircle = HOLDING_ROOM_COUNTDOWN_CIRCLES[0],
  anchorMasks: HoldingRoomCountdownAnchorMasks = HOLDING_ROOM_COUNTDOWN_ANCHOR_MASKS,
): HoldingRoomCountdownCentering {
  const valueCenter = rectCenter(anchorMasks.valueMask);

  return {
    valueCenterOffsetX: valueCenter.x - anchorCircle.cx,
    valueCenterOffsetY: valueCenter.y - anchorCircle.cy,
    valueWidthRatio: anchorMasks.valueMask.width / anchorCircle.width,
    valueHeightRatio: anchorMasks.valueMask.height / anchorCircle.height,
    labelTopGap: anchorMasks.labelMask.top - anchorMasks.valueMask.top,
    labelWidthRatio: anchorMasks.labelMask.width / anchorCircle.width,
    labelHeight: anchorMasks.labelMask.height,
  };
}

function roundPct(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildRect(left: number, top: number, width: number, height: number): HoldingRoomCountdownRect {
  return {
    left: roundPct(left),
    top: roundPct(top),
    width: roundPct(width),
    height: roundPct(height),
  };
}

/** Apply days centering offsets to every measured circle column. */
export function alignHoldingRoomCountdownMasks(
  circles: readonly HoldingRoomCountdownCircle[] = HOLDING_ROOM_COUNTDOWN_CIRCLES,
  centering: HoldingRoomCountdownCentering = measureHoldingRoomCountdownCentering(),
): Record<HoldingRoomCountdownUnitId, HoldingRoomCountdownAnchorMasks> {
  const aligned = {} as Record<HoldingRoomCountdownUnitId, HoldingRoomCountdownAnchorMasks>;

  for (const circle of circles) {
    const valueWidth = circle.width * centering.valueWidthRatio;
    const valueHeight = circle.height * centering.valueHeightRatio;
    const valueCenterX = circle.cx + centering.valueCenterOffsetX;
    const valueCenterY = circle.cy + centering.valueCenterOffsetY;

    const valueMask = buildRect(
      valueCenterX - valueWidth / 2,
      valueCenterY - valueHeight / 2,
      valueWidth,
      valueHeight,
    );

    const labelWidth = circle.width * centering.labelWidthRatio;
    const labelCenterX = valueCenterX;
    const labelTop = valueMask.top + centering.labelTopGap;

    const labelMask = buildRect(
      labelCenterX - labelWidth / 2,
      labelTop,
      labelWidth,
      centering.labelHeight,
    );

    aligned[circle.id] = { valueMask, labelMask };
  }

  return aligned;
}
