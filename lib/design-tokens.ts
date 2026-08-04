/** Awakening — canonical design tokens (source of truth) */

export const BRAND_COLORS = {
  black: "#020203",
  blackDeep: "#040404",
  panel: "#0C0C10",
  blue: "#00A8FF",
  purple: "#8A2EFF",
  pink: "#FF2FAF",
  /** @deprecated Use purple — kept for legacy class mappings */
  indigo: "#8A2EFF",
  white: "#FFFFFF",
  muted: "rgba(255,255,255,0.68)",
  border: "rgba(255,255,255,0.08)",
} as const;

export const BRAND_GRADIENTS = {
  brand: "linear-gradient(90deg, #00A8FF 0%, #8A2EFF 50%, #FF2FAF 100%)",
  brandSoft:
    "linear-gradient(90deg, rgba(0,168,255,0.25) 0%, rgba(255,47,175,0.25) 100%)",
  ring: "linear-gradient(90deg, #00A8FF 0%, #8A2EFF 50%, #FF2FAF 100%)",
} as const;

export const BRAND_TYPOGRAPHY = {
  lockup: {
    fontFamily: "var(--font-headline)",
    fontWeight: 400,
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
  },
  byline: {
    fontFamily: "var(--font-ui)",
    fontWeight: 300,
    letterSpacing: "0.12em",
  },
  tagline: {
    fontFamily: "var(--font-ui)",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
  },
  enter: {
    fontFamily: "var(--font-ui)",
    fontWeight: 500,
    letterSpacing: "0.10em",
    textTransform: "uppercase" as const,
  },
} as const;

export const BRAND_FONTS = {
  headline: "var(--font-headline)",
  ui: "var(--font-ui)",
  body: "var(--font-body)",
  cardTitle: "var(--font-card-title)",
} as const;

export const BRAND_SHADOWS = {
  glowBlue: "0 0 15px #00A8FF, 0 0 30px #00A8FF, 0 0 60px #00A8FF",
  glowPurple: "0 0 15px #8A2EFF, 0 0 30px #8A2EFF, 0 0 60px #8A2EFF",
  glowPink: "0 0 15px #FF2FAF, 0 0 30px #FF2FAF, 0 0 60px #FF2FAF",
  neonBlue: "0 0 15px #00A8FF, 0 0 30px #00A8FF, 0 0 60px #00A8FF",
  neonPink: "0 0 15px #FF2FAF, 0 0 30px #FF2FAF, 0 0 60px #FF2FAF",
  neonPurple: "0 0 15px #8A2EFF, 0 0 30px #8A2EFF, 0 0 60px #8A2EFF",
  neonDual:
    "0 0 15px #FF2FAF, 0 0 30px #FF2FAF, 0 0 15px #00A8FF, 0 0 30px #00A8FF",
  pillCta:
    "0 0 15px rgba(255,47,175,0.45), 0 0 30px rgba(0,168,255,0.35)",
  panel: "0 0 34px rgba(0,0,0,0.45)",
} as const;

export type BrandColorKey = keyof typeof BRAND_COLORS;
