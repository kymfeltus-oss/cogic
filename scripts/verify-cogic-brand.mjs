#!/usr/bin/env node

import fs from "node:fs";

const cssPath = "styles/cogic-brand.css";
const tsPath = "lib/brand/colors.ts";
const dashboardPath = "app/my-convocation/dashboard.css";
const navPath = "components/dashboard/DashboardMobileNav.tsx";
const globalPath = "app/globals.css";
const backdropPath = "components/brand/BrandBackdrop.tsx";
const watermarkPath = "components/brand/BrandWatermark.tsx";
const shellPath = "components/RootLayoutShell.tsx";

const files = Object.fromEntries(
  [
    cssPath,
    tsPath,
    dashboardPath,
    navPath,
    globalPath,
    backdropPath,
    watermarkPath,
    shellPath,
  ].map((file) => [file, fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""]),
);

const approvedStops = ["#32104f", "#54157f", "#7227b3", "#8b39d0", "#c62a9b", "#168fea", "#20c4f4"];
const legacyStops = ["#7c3aed", "#a855f7", "#d946ef", "#ec4899", "#6366f1", "#3b82f6", "#22d3ee"];

const checks = [
  ["canonical CSS exists", Boolean(files[cssPath])],
  ["canonical TypeScript tokens exist", files[tsPath].includes("export const cogicBrand")],
  ["semantic action token", files[cssPath].includes("--cogic-action-primary:")],
  ["approved cinematic ombre stops", approvedStops.every((stop) => files[cssPath].toLowerCase().includes(stop))],
  ["approved cinematic ombre gradient", /--brand-ombre:\s*linear-gradient\(\s*110deg/.test(files[cssPath])],
  ["magenta stop visible in ombre", files[cssPath].toLowerCase().includes("#c62a9b")],
  ["compact control gradient", files[cssPath].includes("--brand-ombre-compact:")],
  ["semantic ombre utility", files[cssPath].includes(".brand-ombre-bg")],
  ["semantic live token", files[cssPath].includes("--cogic-status-live:")],
  ["semantic surface token", files[cssPath].includes("--cogic-surface-page:")],
  ["BrandBackdrop component", files[backdropPath].includes("brand-backdrop")],
  ["BrandWatermark uses official seal", files[watermarkPath].includes("/branding/cogic-seal.png")],
  ["RootLayoutShell mounts BrandBackdrop", files[shellPath].includes("BrandBackdrop")],
  ["shared glass card utility", files[cssPath].includes(".brand-glass-card")],
  ["shared gradient button utility", files[cssPath].includes(".brand-gradient-button")],
  ["ambient wave system", files[cssPath].includes(".brand-backdrop__wave")],
  ["reduced motion respected", files[cssPath].includes("prefers-reduced-motion")],
  ["Tailwind v4 mapping", files[cssPath].includes("@theme inline")],
  ["dashboard consumes canonical tokens", files[dashboardPath].includes("Canonical COGIC LIVE brand pilot")],
  ["mobile nav fixed to viewport", /\.cl-bottom-nav\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?right:\s*0;[\s\S]*?bottom:\s*0;[\s\S]*?left:\s*0;/.test(files[dashboardPath])],
  ["mobile nav is attached", /border-radius:\s*0;/.test(files[dashboardPath])],
  ["dashboard mobile nav uses ombre", /\.cl-bottom-nav\s*\{[\s\S]*?background:\s*var\(--brand-ombre\);/.test(files[dashboardPath])],
  ["global bottom dock uses ombre", /\.bottom-dock__frame\s*\{[\s\S]*?background:\s*var\(--brand-ombre\);/.test(files[globalPath])],
  ["retired core purple removed from canonical tokens", !/#5c2d91|#3b1a63|#7b4bb8/i.test(files[cssPath])],
  ["legacy neon stops not required as canonical", !legacyStops.every((stop) => files[cssPath].toLowerCase().includes(stop))],
  ["Watch Live route preserved", files[navPath].includes('{ label: "Watch Live", href: "/live"')],
];

for (const [label, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
const failed = checks.filter(([, passed]) => !passed);
console.log(`\n${checks.length - failed.length}/${checks.length} brand checks passed.`);
process.exit(failed.length ? 1 : 0);
