/**
 * Production performance checklist for Today's Service / streaming dashboard.
 *
 * Usage:
 *   npm run perf:production
 *
 * Lighthouse (manual):
 *   1. Run `npm run build` then `npm run start`
 *   2. Open Chrome Incognito with extensions DISABLED
 *      (Adobe Acrobat sidePanelUtil.js and similar extensions inflate main-thread cost)
 *   3. Sign in as ops admin → /dashboard/todays-service
 *   4. Lighthouse → Performance → analyze
 *
 * Targets: LCP < 2.5s, CLS < 0.1
 */
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const PORT = process.env.PORT ?? "3000";
const BASE_URL = process.env.PERF_BASE_URL ?? `http://127.0.0.1:${PORT}`;

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      /* server still starting */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

async function main() {
  console.log("=== Parable production performance check ===\n");
  console.log("Step 1/3: production build…");
  await run("npm", ["run", "build"], "build");

  console.log("\nStep 2/3: starting production server…");
  const server = spawn("npm", ["run", "start"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PORT },
  });

  try {
    await waitForServer(BASE_URL);
    console.log(`\nStep 3/3: server ready at ${BASE_URL}`);
    console.log("\nManual Lighthouse (required for LCP/CLS scores):");
    console.log("  • Chrome Incognito, extensions OFF");
    console.log("  • Navigate to /dashboard/todays-service (authenticated)");
    console.log("  • Verify LCP paints service title before streaming cards hydrate");
    console.log("  • Verify streaming section title does not shift when destinations load");
    console.log("\nOptional server load probe:");
    console.log("  node scripts/measure-todays-service-load.mjs");
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
