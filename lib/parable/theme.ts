/**
 * Parable production brand — sourced from ParableTest app
 * (globals.css, lib/constants.ts, styles/parable-theme.css, tailwind.config.ts)
 */

export const PARABLE_COLORS = {
  black: "#000000",
  sanctuaryBlack: "#010101",
  panel: "#111111",
  cyan: "#00f2ff",
  green: "#53fc18",
  violet: "#8b5cf6",
  red: "#ef4444",
  muted: "#9ca3af",
  border: "rgba(255, 255, 255, 0.1)",
  glass: "rgba(255, 255, 255, 0.03)",
} as const;

export const PARABLE_TYPOGRAPHY = {
  /** Parable lockup / hero headings */
  logo: "font-black italic uppercase tracking-tight",
  /** HUD labels, status chips */
  hud: "font-mono uppercase tracking-[0.3em] text-[0.5rem] font-black",
  /** Section headings */
  heading: "text-3xl font-black italic uppercase tracking-tight",
  /** Card titles */
  cardTitle: "text-lg font-extrabold uppercase tracking-wide",
  /** Muted helper copy */
  subtext: "text-xs text-gray-400",
  /** Default body stack */
  body: "font-sans antialiased",
} as const;

export const PARABLE_STATUS = {
  green: {
    text: "text-[#53fc18]",
    border: "border-[#53fc18]/40",
    bg: "bg-[#53fc18]/10",
    dot: "bg-[#53fc18]",
  },
  yellow: {
    text: "text-yellow-300",
    border: "border-yellow-400/40",
    bg: "bg-yellow-400/10",
    dot: "bg-yellow-400",
  },
  red: {
    text: "text-red-400",
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    dot: "bg-red-400",
  },
  orange: {
    text: "text-orange-300",
    border: "border-orange-500/40",
    bg: "bg-orange-500/10",
    dot: "bg-orange-500",
  },
  black: {
    text: "text-white",
    border: "border-black",
    bg: "bg-black",
    dot: "bg-white",
  },
  cyan: {
    text: "text-[#00f2ff]",
    border: "border-[#00f2ff]/40",
    bg: "bg-[#00f2ff]/10",
    dot: "bg-[#00f2ff]",
  },
} as const;

export const PARABLE_SHELL = {
  page: "min-h-dvh bg-black text-white selection:bg-[#00f2ff] selection:text-black",
  header: "border-b border-white/10 bg-[#111111]/90 backdrop-blur-md",
  panel: "rounded-2xl border border-white/10 bg-[#111111] p-5",
  panelHover: "hover:border-[#53fc18]/60 transition",
  accentCyan: "text-[#00f2ff]",
  accentGreen: "text-[#53fc18]",
  accentViolet: "text-[#8b5cf6]",
  borderCyan: "border-[#00f2ff]/40",
  borderGreen: "border-[#53fc18]/40",
  btnPrimary:
    "bg-[#00f2ff] text-black font-black uppercase tracking-[0.08em] hover:bg-white transition shadow-[0_0_20px_rgba(0,242,255,0.25)]",
  btnSecondary:
    "border border-[#00f2ff]/30 bg-black text-white hover:border-[#00f2ff] transition",
  btnGreen:
    "bg-[#53fc18] text-black font-black uppercase tracking-[0.08em] hover:opacity-90 shadow-[0_0_20px_rgba(83,252,24,0.25)]",
  btnViolet: "bg-violet-600 hover:bg-violet-700 text-sm font-bold text-white rounded-lg",
  muted: "text-gray-400",
  input:
    "w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:border-[#00f2ff]/50 focus:shadow-[0_0_15px_rgba(0,242,255,0.1)]",
  link: "font-black uppercase tracking-[0.08em] text-[#00f2ff] hover:text-white text-[0.55rem]",
  glowCyan: "shadow-[0_0_30px_rgba(0,242,255,0.18)]",
  glowGreen: "shadow-[0_0_30px_rgba(83,252,24,0.18)]",
  /** Legacy broadcast console aliases */
  accentBlue: "text-[#00f2ff]",
  accentMagenta: "text-[#53fc18]",
  borderBlue: "border-[#00f2ff]/40",
  borderMagenta: "border-[#53fc18]/40",
} as const;
