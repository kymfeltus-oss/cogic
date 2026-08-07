/** Canonical COGIC LIVE visual tokens. Components should prefer semantic CSS aliases. */
export const cogicBrand = {
  ombre: {
    deep: "#32104F",
    start: "#54157F",
    violet: "#7227B3",
    bright: "#8B39D0",
    magenta: "#C62A9B",
    blue: "#168FEA",
    cyan: "#20C4F4",
    fuchsia: "#C62A9B",
    pink: "#C62A9B",
    indigo: "#7227B3",
    plum: "#C62A9B",
    end: "#168FEA",
    gradient:
      "linear-gradient(110deg, #54157F 0%, #7227B3 28%, #8B39D0 48%, #C62A9B 72%, #168FEA 100%)",
    active:
      "linear-gradient(110deg, #54157F 0%, #7227B3 35%, #9A34C6 62%, #C62A9B 100%)",
  },
  surfaces: {
    ink: "#05060D",
    navy: "#070B18",
    surfaceNavy: "#0B1020",
    deepPurple: "#32104F",
    panel: "rgba(12, 10, 28, 0.92)",
    panelRaised: "rgba(18, 12, 36, 0.94)",
    glass: "rgba(10, 8, 24, 0.72)",
    overlay: "rgba(5, 7, 17, 0.86)",
  },
  purple: {
    primary: "#7227B3",
    deep: "#54157F",
    bright: "#8B39D0",
    soft: "rgba(114, 39, 179, 0.16)",
    glow: "rgba(198, 42, 155, 0.24)",
  },
  gold: {
    primary: "#C9A227",
    bright: "#E0B93A",
    soft: "rgba(201, 162, 39, 0.14)",
    line: "rgba(201, 162, 39, 0.28)",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "rgba(255, 255, 255, 0.68)",
    subtle: "rgba(255, 255, 255, 0.46)",
    disabled: "rgba(255, 255, 255, 0.32)",
    onGold: "#07040F",
  },
  border: {
    default: "rgba(255, 255, 255, 0.10)",
    strong: "rgba(255, 255, 255, 0.16)",
    purple: "rgba(139, 57, 208, 0.42)",
    gold: "rgba(201, 162, 39, 0.28)",
  },
  status: {
    live: "#E11D48",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#168FEA",
    offline: "rgba(255, 255, 255, 0.46)",
  },
} as const;

export const dashboardStatusTokens = {
  live: { label: "LIVE", foreground: cogicBrand.text.primary, background: cogicBrand.status.live },
  upcoming: { label: "UPCOMING", foreground: cogicBrand.gold.bright, background: cogicBrand.gold.soft },
  ready: { label: "READY", foreground: cogicBrand.purple.bright, background: cogicBrand.purple.soft },
  offline: { label: "OFFLINE", foreground: cogicBrand.text.secondary, background: "rgba(255, 255, 255, 0.06)" },
} as const;
