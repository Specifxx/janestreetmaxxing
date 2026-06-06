/*
 * Walk-forward MONTHLY backtest.
 *
 * Question: "pretend last month didn't happen — predict that month's direction
 * from data available the day before it started. How accurate is it?"
 *
 * Integrity rules:
 *  - Uses the EXACT production factor functions (computeIndicators +
 *    momentumScore + technicalScore from src/lib). These are the price-based
 *    factors of the app's composite score. The Value/Quality/Sentiment factors
 *    are NOT testable here because they need point-in-time fundamentals
 *    (historical EPS/FCF/analyst targets), which we don't have — applying
 *    today's fundamentals to the past would be look-ahead bias, so they are
 *    deliberately excluded rather than faked.
 *  - No look-ahead: to predict month M we feed ONLY the trailing 252 sessions
 *    up to the LAST trading day of month M-1. Month M's outcome is never seen.
 *  - Non-overlapping calendar months => statistically independent samples.
 *  - Real data: S&P 500 daily OHLCV 2013-2018 (plotly/datasets).
 *
 * Prediction: price-based bull score = (Momentum*0.25 + Technicals*0.15)/0.40,
 * on a 0-100 scale (the same factors/weights the live app uses). Predict the
 * month UP if score >= threshold.
 *
 * Usage: npx tsx scripts/backtest-monthly.ts [csvPath] [maxTickers]
 */

import { readFileSync } from "node:fs";
import { computeIndicators } from "@/lib/analysis/indicators";
import { momentumScore, technicalScore } from "@/lib/analysis/score";
import type { OHLC } from "@/lib/types";

const csvPath = process.argv[2] || "/tmp/sp500_5yr.csv";
const maxTickers = Number(process.argv[3]) || Infinity;
const WINDOW = 252; // trailing sessions fed to the model (== live app's 1y fetch)

function loadByTicker(path: string): Map<string, OHLC[]> {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  const h = lines[0].split(",");
  const ix = {
    date: h.indexOf("date"), open: h.indexOf("open"), high: h.indexOf("high"),
    low: h.indexOf("low"), close: h.indexOf("close"), volume: h.indexOf("volume"),
    name: h.indexOf("Name"),
  };
  const by = new Map<string, OHLC[]>();
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (c.length < 7) continue;
    const close = parseFloat(c[ix.close]);
    if (!isFinite(close) || close <= 0) continue;
    const bar: OHLC = {
      date: c[ix.date], open: parseFloat(c[ix.open]) || close,
      high: parseFloat(c[ix.high]) || close, low: parseFloat(c[ix.low]) || close,
      close, adjClose: close, volume: parseInt(c[ix.volume]) || 0,
    };
    const arr = by.get(c[ix.name]) ?? [];
    arr.push(bar);
    by.set(c[ix.name], arr);
  }
  for (const arr of by.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
  return by;
}

// Last-trading-day-of-month indices for a ticker's bar series.
function monthEndIndices(bars: OHLC[]): number[] {
  const ends: number[] = [];
  for (let i = 0; i < bars.length - 1; i++) {
    const m = bars[i].date.slice(0, 7); // yyyy-mm
    const next = bars[i + 1].date.slice(0, 7);
    if (m !== next) ends.push(i);
  }
  ends.push(bars.length - 1);
  return ends;
}

// The price-based bull score the live app would assign at a point in time.
function bullScore(window: OHLC[]): number {
  const ind = computeIndicators(window);
  const price = window[window.length - 1].close;
  const mom = momentumScore(ind, price); // weight 0.25 in the app
  const tech = technicalScore(ind, price); // weight 0.15 in the app
  return (mom.score * 0.25 + tech.score * 0.15) / 0.4;
}

interface Bucket { n: number; hits: number; retSum: number; }
const mk = (): Bucket => ({ n: 0, hits: 0, retSum: 0 });
const thresholds = [50, 55, 60, 65];
const buckets = new Map(thresholds.map((t) => [t, mk()]));

let total = 0, monthsUp = 0, retAll = 0;
const bearBucket = mk(); // predicted DOWN (score < 50): did month actually fall?
const decile = Array.from({ length: 11 }, () => ({ n: 0, up: 0, ret: 0 }));

const data = loadByTicker(csvPath);
let used = 0;
for (const [, bars] of data) {
  if (used >= maxTickers) break;
  if (bars.length < WINDOW + 25) continue;
  used++;
  const ends = monthEndIndices(bars);
  for (let k = 0; k < ends.length - 1; k++) {
    const i = ends[k]; // last trading day of month M-1 (known)
    const j = ends[k + 1]; // last trading day of month M (outcome)
    if (i < WINDOW - 1) continue; // need full trailing window
    const window = bars.slice(i - WINDOW + 1, i + 1);
    const score = bullScore(window);
    const ret = (bars[j].close - bars[i].close) / bars[i].close; // month M return
    const up = ret > 0;

    total++;
    retAll += ret;
    if (up) monthsUp++;

    const d = decile[Math.min(10, Math.floor(score / 10))];
    d.n++; d.ret += ret; if (up) d.up++;

    for (const t of thresholds) {
      if (score >= t) {
        const b = buckets.get(t)!;
        b.n++; b.retSum += ret; if (up) b.hits++;
      }
    }
    if (score < 50) { bearBucket.n++; bearBucket.retSum += ret; if (!up) bearBucket.hits++; }
  }
}

const pct = (x: number) => (x * 100).toFixed(2) + "%";
const baseRate = monthsUp / total;

console.log("\n============== MONTHLY DIRECTION BACKTEST (price factors) ==============");
console.log(`Data:        ${csvPath}`);
console.log(`Tickers:     ${used}`);
console.log(`Predictions: ${total.toLocaleString()} non-overlapping ticker-months (no look-ahead)`);
console.log(`Model:       app's price factors  (Momentum 0.25 + Technicals 0.15)/0.40, trailing ${WINDOW}d`);
console.log(`\nBaseline ("assume every month is up"):`);
console.log(`  monthly up-rate (base rate): ${pct(baseRate)}`);
console.log(`  avg monthly return (all):    ${pct(retAll / total)}`);

console.log(`\n--- Predict UP when bull-score >= threshold ---`);
console.log("thresh |  calls  | accuracy (month up) | edge vs base | avg fwd-month ret");
for (const t of thresholds) {
  const b = buckets.get(t)!;
  if (!b.n) continue;
  const acc = b.hits / b.n;
  console.log(`  ${t}   | ${String(b.n).padStart(7)} |       ${pct(acc).padStart(7)}       |   ${((acc - baseRate) * 100).toFixed(2)}pp   |    ${pct(b.retSum / b.n)}`);
}

console.log(`\n--- Predict DOWN when bull-score < 50 ---`);
if (bearBucket.n)
  console.log(`  calls ${bearBucket.n}, correctly-down ${pct(bearBucket.hits / bearBucket.n)}, avg fwd-month ret ${pct(bearBucket.retSum / bearBucket.n)}`);

// Overall directional accuracy: up-call correct if up, down-call correct if down.
const upCalls = buckets.get(50)!;
const correct = upCalls.hits + bearBucket.hits;
console.log(`\n>>> OVERALL DIRECTIONAL ACCURACY (up if score>=50 else down): ${pct(correct / total)}`);
console.log(`    vs base rate ${pct(baseRate)}  =>  edge ${((correct / total - baseRate) * 100).toFixed(2)}pp`);

console.log(`\n--- Calibration: actual up-rate & avg return by bull-score decile ---`);
console.log("score bin |   n    | up-rate | avg fwd-month ret");
for (let k = 0; k <= 10; k++) {
  const d = decile[k];
  if (!d.n) continue;
  console.log(`  ${String(k * 10).padStart(3)}     | ${String(d.n).padStart(6)} | ${pct(d.up / d.n).padStart(7)} |   ${pct(d.ret / d.n)}`);
}
console.log("=======================================================================\n");
