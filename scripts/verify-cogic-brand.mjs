#!/usr/bin/env node

import fs from "node:fs";

const cssPath = "styles/cogic-brand.css";
const tsPath = "lib/brand/colors.ts";
const dashboardPath = "app/my-convocation/dashboard.css";
const navPath = "components/dashboard/DashboardMobileNav.tsx";

const files = Object.fromEntries(
  [cssPath, tsPath, dashboardPath, navPath].map((file) => [file, fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""]),
);

const checks = [
  ["canonical CSS exists", Boolean(files[cssPath])],
  ["canonical TypeScript tokens exist", files[tsPath].includes("export const cogicBrand")],
  ["semantic action token", files[cssPath].includes("--cogic-action-primary:")],
  ["semantic live token", files[cssPath].includes("--cogic-status-live:")],
  ["semantic surface token", files[cssPath].includes("--cogic-surface-page:")],
  ["Tailwind v4 mapping", files[cssPath].includes("@theme inline")],
  ["dashboard consumes canonical tokens", files[dashboardPath].includes("Canonical COGIC LIVE brand pilot")],
  ["mobile nav fixed to viewport", /\.cl-bottom-nav\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?right:\s*0;[\s\S]*?bottom:\s*0;[\s\S]*?left:\s*0;/.test(files[dashboardPath])],
  ["mobile nav is attached", /border-radius:\s*0;/.test(files[dashboardPath])],
  ["Watch Live route preserved", files[navPath].includes('{ label: "Watch Live", href: "/live"')],
];

for (const [label, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
const failed = checks.filter(([, passed]) => !passed);
console.log(`\n${checks.length - failed.length}/${checks.length} brand checks passed.`);
process.exit(failed.length ? 1 : 0);
