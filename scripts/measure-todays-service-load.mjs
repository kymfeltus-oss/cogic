/**
 * Measures server-side Today's Service load phases.
 * Run: node scripts/measure-todays-service-load.mjs
 */
import { performance } from "node:perf_hooks";

async function main() {
  const { loadTodaysService } = await import("../lib/todays-service/service.ts");
  const { getOrCreateTodayService } = await import("../lib/todays-service/repository.ts");
  const { DEFAULT_SERVICE_TENANT_ID } = await import("../lib/todays-service/types.ts");

  const results = [];

  let t0 = performance.now();
  await getOrCreateTodayService(DEFAULT_SERVICE_TENANT_ID);
  results.push({ phase: "getOrCreateTodayService", ms: Math.round(performance.now() - t0) });

  t0 = performance.now();
  await loadTodaysService(DEFAULT_SERVICE_TENANT_ID, undefined, { purpose: "display" });
  results.push({ phase: "loadTodaysService (display)", ms: Math.round(performance.now() - t0) });

  t0 = performance.now();
  await loadTodaysService(DEFAULT_SERVICE_TENANT_ID, undefined, { purpose: "mutation" });
  results.push({ phase: "loadTodaysService (mutation)", ms: Math.round(performance.now() - t0) });

  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
