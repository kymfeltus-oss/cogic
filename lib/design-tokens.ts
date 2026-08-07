/** COGIC LIVE — canonical design tokens aligned to styles/cogic-brand.css */

export const BRAND_COLORS = {
  black: "#05060D",
  blackDeep: "#070B18",
  panel: "#0B1020",
  blue: "#168FEA",
  purple: "#7227B3",
  pink: "#C62A9B",
  fuchsia: "#C62A9B",
  indigo: "#7227B3",
  cyan: "#20C4F4",
  white: "#FFFFFF",
  muted: "rgba(255,255,255,0.68)",
  border: "rgba(255,255,255,0.08)",
} as const;

export const BRAND_GRADIENTS = {
  brand:
    "linear-gradient(110deg, #54157F 0%, #7227B3 28%, #8B39D0 48%, #C62A9B 72%, #168FEA 100%)",
  brandSoft:
    "linear-gradient(110deg, rgba(84,21,127,0.22) 0%, rgba(198,42,155,0.14) 72%, rgba(22,143,234,0.10) 100%)",
  active:
    "linear-gradient(110deg, #54157F 0%, #7227B3 35%, #9A34C6 62%, #C62A9B 100%)",
  ring:
    "linear-gradient(110deg, #54157F 0%, #8B39D0 48%, #C62A9B 72%, #168FEA 100%)",
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
  glowBlue: "0 0 22px rgba(22,143,234,0.22)",
  glowPurple: "0 0 28px rgba(114,39,179,0.32)",
  glowPink: "0 0 28px rgba(198,42,155,0.28)",
  neonBlue: "0 0 22px rgba(22,143,234,0.22)",
  neonPink: "0 0 28px rgba(198,42,155,0.28)",
  neonPurple: "0 0 28px rgba(114,39,179,0.32)",
  neonDual:
    "0 0 18px rgba(198,42,155,0.22), 0 0 22px rgba(22,143,234,0.16)",
  pillCta:
    "0 14px 34px rgba(84,21,127,0.22), 0 0 26px rgba(198,42,155,0.16)",
  panel: "0 0 34px rgba(0,0,0,0.45)",
} as const;

export type BrandColorKey = keyof typeof BRAND_COLORS;
