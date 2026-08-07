/** Canonical COGIC LIVE visual tokens. Components should prefer semantic CSS aliases. */
export const cogicBrand = {
  ombre: {
    start: "#204366",
    blue: "#2B5989",
    slate: "#3A4C83",
    violet: "#4B3174",
    plum: "#6B2F6E",
    end: "#742B62",
    gradient: "linear-gradient(110deg, #204366 0%, #2B5989 20%, #3A4C83 40%, #4B3174 60%, #6B2F6E 80%, #742B62 100%)",
  },
  surfaces: {
    ink: "#07040F",
    navy: "#0B1220",
    panel: "rgba(14, 10, 28, 0.92)",
    panelRaised: "rgba(19, 14, 38, 0.96)",
    overlay: "rgba(7, 4, 15, 0.82)",
  },
  purple: {
    /** Episcopal / institutional primary — darker than neon tech violet */
    primary: "#4B3174",
    deep: "#204366",
    bright: "#6B2F6E",
    soft: "rgba(75, 49, 116, 0.18)",
    glow: "rgba(75, 49, 116, 0.28)",
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
    purple: "rgba(75, 49, 116, 0.52)",
    gold: "rgba(201, 162, 39, 0.28)",
  },
  status: {
    live: "#E11D48",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
    offline: "rgba(255, 255, 255, 0.46)",
  },
} as const;

export const dashboardStatusTokens = {
  live: { label: "LIVE", foreground: cogicBrand.text.primary, background: cogicBrand.status.live },
  upcoming: { label: "UPCOMING", foreground: cogicBrand.gold.bright, background: cogicBrand.gold.soft },
  ready: { label: "READY", foreground: cogicBrand.purple.bright, background: cogicBrand.purple.soft },
  offline: { label: "OFFLINE", foreground: cogicBrand.text.secondary, background: "rgba(255, 255, 255, 0.06)" },
} as const;
