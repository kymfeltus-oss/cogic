#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOTS = ["app", "components", "lib", "styles"];
const EXTENSIONS = new Set([".css", ".scss", ".ts", ".tsx", ".js", ".jsx"]);
const PATTERNS = [
  ["legacy_electric_blue", /#00a8ff\b/gi],
  ["legacy_neon_pink", /#ff2faf\b|#ff008c\b/gi],
  ["legacy_neon_purple", /#8a2eff\b/gi],
  ["hard_coded_black", /#000000\b|#000\b/gi],
];

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (["node_modules", ".next", ".git"].includes(entry.name)) return [];
    if (entry.isDirectory()) return walk(full);
    return EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

function classify(relativePath, line, token) {
  if (relativePath === "app/globals.css" && /--gradient-brand|--shadow-glow|--color-brand-/.test(line)) {
    return "obsolete_legacy_brand";
  }
  if (/status|live|error|warning|success|danger/i.test(line)) return "valid_functional_status";
  if (/asset|image|artwork|gradient/i.test(relativePath)) return "image_or_artwork_related";
  if (token === "hard_coded_black") return "intentional_local_styling_review";
  return "safe_to_migrate_review";
}

function isDashboardScope(relativePath) {
  return relativePath === "app/my-convocation/dashboard.css"
    || relativePath.startsWith("components/dashboard/")
    || relativePath === "app/my-convocation/page.tsx"
    || relativePath === "app/my-sanctuary/page.tsx";
}

function dashboardDisposition(relativePath, classification) {
  if (!isDashboardScope(relativePath)) return "D_OUTSIDE_DASHBOARD_SCOPE";
  if (classification === "obsolete_legacy_brand") return "A_OBSOLETE_LEGACY_BRAND";
  if (classification === "safe_to_migrate_review") return "B_SAFE_TO_MIGRATE";
  return "C_INTENTIONAL_FUNCTIONAL_LOCAL_STYLE";
}

const findings = [];
for (const root of ROOTS) {
  for (const file of walk(path.join(ROOT, root))) {
    const relativePath = path.relative(ROOT, file).replaceAll("\\", "/");
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, index) => {
      for (const [token, pattern] of PATTERNS) {
        pattern.lastIndex = 0;
        const matches = line.match(pattern) ?? [];
        for (const literal of matches) {
          const classification = classify(relativePath, line, token);
          findings.push({
            file: relativePath,
            line: index + 1,
            token,
            literal,
            classification,
            dashboardDisposition: dashboardDisposition(relativePath, classification),
          });
        }
      }
    });
  }
}

const classifications = findings.reduce((summary, item) => {
  summary[item.classification] = (summary[item.classification] ?? 0) + 1;
  return summary;
}, {});
const dashboardDispositions = findings.reduce((summary, item) => {
  summary[item.dashboardDisposition] = (summary[item.dashboardDisposition] ?? 0) + 1;
  return summary;
}, {});

const summaryOnly = process.argv.includes("--summary");
console.log(JSON.stringify({ findingCount: findings.length, classifications, dashboardDispositions, ...(summaryOnly ? {} : { findings }) }, null, 2));
console.log("Brand audit is report-only; no files were modified.");
