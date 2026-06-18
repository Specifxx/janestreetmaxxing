/*
 * Offline self-test for the Heikin Ashi + Volume Oscillator engine.
 * Builds a synthetic downtrend that flips up on expanding volume and checks the
 * engine fires a LONG. Run: npx tsx scripts/ha-test.ts
 */
import { evaluateHeikinAshi } from "@/lib/strategies/heikinashi";
import type { Bar5m } from "@/lib/orb/signal";

const bars: Bar5m[] = [];
let px = 100;
// 14 down bars (low volume), then ONE strong up bar on big volume = the flip bar
for (let i = 0; i < 14; i++) {
  const o = px, c = px - 0.6; px = c;
  bars.push({ time: `2026-06-15T${String(10 + i).padStart(2, "0")}:00`, open: o, high: o + 0.1, low: c - 0.1, close: c, volume: 800 });
}
{
  const o = px, c = px + 3.0; px = c;
  bars.push({ time: `2026-06-16T10:00`, open: o, high: c + 0.05, low: o - 0.02, close: c, volume: 3000 });
}

const sig = evaluateHeikinAshi(bars);
console.log("Heikin Ashi + Volume Oscillator — synthetic flip-up test\n");
console.log(`Direction: ${sig.direction} | allGo: ${sig.allGo} | strength: ${sig.prob} | ${sig.reason}`);
for (const f of sig.factors) console.log(`  ${f.ok ? "✓" : "·"} F${f.n} ${f.label}: ${f.detail}`);
console.log(`\nEntry: ${sig.entryPrice}`);
console.log(sig.direction === "long" && sig.allGo ? "\n✓ PASS — fired LONG on the volume-confirmed HA flip" : "\n✗ FAIL");
process.exit(sig.direction === "long" && sig.allGo ? 0 : 1);

export {};
