#!/usr/bin/env node
// Load test against a locally running production build (npm run build &&
// npm run start). Two separate benchmarks, deliberately not one combined
// number, because they measure different things:
//
//   1. Home page (/) -- static/prerendered, no external API calls, no rate
//      limit. This reflects the Next.js server's own raw serving capacity.
//   2. /api/risk -- the most complex route: ~7 parallel external API calls,
//      risk-model computation, ML feature snapshot, WASM cross-check. This
//      is rate-limited to 30 req/min by design (src/app/api/risk/route.ts),
//      so it's benchmarked with a bounded request count well under that
//      limit rather than sustained high RPS -- the point is realistic
//      per-request latency, not "how fast can we get 429s."
//
// Run: npm run start (in one terminal), then:
//   node scripts/load-test.mjs
import autocannon from "autocannon";

const BASE_URL = process.env.LOAD_TEST_URL ?? "http://localhost:3000";

function printSummary(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log(`Requests: ${result.requests.total} over ${(result.duration).toFixed(1)}s`);
  console.log(`Throughput: ${result.requests.average.toFixed(1)} req/s (avg)`);
  console.log(`Latency (ms): p50=${result.latency.p50} p97.5=${result.latency.p97_5} p99=${result.latency.p99} max=${result.latency.max}`);
  console.log(`Status codes: ${JSON.stringify(result.statusCodeStats)}`);
  if (result.errors) console.log(`Errors: ${result.errors}`);
  if (result.non2xx) console.log(`Non-2xx: ${result.non2xx}`);
}

async function main() {
  console.log(`Load testing against ${BASE_URL}`);

  const homeResult = await autocannon({
    url: `${BASE_URL}/`,
    connections: 20,
    duration: 15,
  });
  printSummary("Home page (/) -- static, no rate limit", homeResult);

  // Bounded request count, one connection at a time, well under the
  // 30 req/min rate limit on /api/risk -- this measures realistic
  // per-request latency for the app's heaviest route, not throughput.
  const riskResult = await autocannon({
    url: `${BASE_URL}/api/risk?zipCode=90001`,
    connections: 1,
    amount: 20,
  });
  printSummary("/api/risk?zipCode=90001 -- rate-limited, 20 sequential requests", riskResult);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
