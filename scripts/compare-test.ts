/*
 * Offline smoke-test for the strategy comparison engine. Generates a few
 * synthetic trending sessions and confirms runComparison produces stats for
 * both strategies without error. Run: npx tsx scripts/compare-test.ts
 */
import { runComparison } from "@/lib/strategies/compare";
import type { Bar5m } from "@/lib/orb/signal";

const bars: Bar5m[] = [];
let px = 7800;
for (let d = 1; d <= 8; d++) {
  const day = `2026-06-${String(d).padStart(2, "0")}`;
  const trend = d % 2 === 0 ? 1 : -1; // alternate up/down days
  // small overnight gap to give ORB a direction
  px += trend * 30;
  for (let i = 0; i < 70; i++) {
    const o = px;
    const drift = trend * (0.6 + Math.sin(i / 5));
    const c = px + drift;
    px = c;
    const hh = String(10 + Math.floor((i * 5) / 60)).padStart(2, "0");
    const mm = String((i * 5) % 60).padStart(2, "0");
    bars.push({ time: `${day}T${hh}:${mm}`, open: o, high: Math.max(o, c) + 1, low: Math.min(o, c) - 1, close: c, volume: 1000 + (i % 7) * 300 });
  }
}

const r = runComparison(bars);
console.log(`Tested ${r.bars} bars / ${r.days} sessions · exit ${r.params.targetPct}%/${r.params.stopPct}%\n`);
for (const s of [r.orb, r.heikinashi]) {
  console.log(`${s.name}: ${s.trades} trades, ${s.winRatePct.toFixed(1)}% win, total ${s.totalReturnPct.toFixed(2)}%, maxDD ${s.maxDrawdownPct.toFixed(1)}%`);
}
const ok = typeof r.orb.totalReturnPct === "number" && typeof r.heikinashi.totalReturnPct === "number";
console.log(ok ? "\n✓ PASS — both strategies produced stats" : "\n✗ FAIL");
process.exit(ok ? 0 : 1);

export {};
