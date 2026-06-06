/*
 * Walk-forward backtest of the short-term ("ODTE") direction model.
 *
 * Integrity rules:
 *  - Uses the EXACT production functions (computeIndicators, shortTermBull).
 *  - No look-ahead: to predict day i+1 we feed ONLY data up to and including
 *    day i, and only the trailing 252 sessions (the same 1-year window the live
 *    app fetches). The actual outcome on day i+1 is never visible to the model.
 *  - Real market data: S&P 500 daily OHLCV 2013-2018 (plotly/datasets).
 *
 * What it measures: when the model says P(up) for the next session, how often
 * does the next session actually close higher — overall, and for the confident
 * subset — versus the unconditional base rate (the "always guess up" baseline).
 *
 * Usage:  npx tsx scripts/backtest.ts [csvPath] [maxTickers]
 *   csvPath defaults to /tmp/sp500_5yr.csv
 *   download: curl -o /tmp/sp500_5yr.csv \
 *     https://raw.githubusercontent.com/plotly/datasets/master/all_stocks_5yr.csv
 */

import { readFileSync } from "node:fs";
import { computeIndicators } from "@/lib/analysis/indicators";
import { shortTermBull } from "@/lib/analysis/odte";
import type { OHLC, Snapshot } from "@/lib/types";

const csvPath = process.argv[2] || "/tmp/sp500_5yr.csv";
const maxTickers = Number(process.argv[3]) || Infinity;
const WINDOW = 252; // trailing sessions fed to the model (== live app's 1y fetch)

// ---- Load + group the CSV by ticker ---------------------------------------
function loadByTicker(path: string): Map<string, OHLC[]> {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  const header = lines[0].split(",");
  const ix = {
    date: header.indexOf("date"),
    open: header.indexOf("open"),
    high: header.indexOf("high"),
    low: header.indexOf("low"),
    close: header.indexOf("close"),
    volume: header.indexOf("volume"),
    name: header.indexOf("Name"),
  };
  const byTicker = new Map<string, OHLC[]>();
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (c.length < 7) continue;
    const close = parseFloat(c[ix.close]);
    const open = parseFloat(c[ix.open]);
    if (!isFinite(close) || !isFinite(open) || close <= 0) continue; // skip gaps
    const sym = c[ix.name];
    const bar: OHLC = {
      date: c[ix.date],
      open,
      high: parseFloat(c[ix.high]) || close,
      low: parseFloat(c[ix.low]) || close,
      close,
      adjClose: close, // dataset is already split/div consistent for our purpose
      volume: parseInt(c[ix.volume]) || 0,
    };
    const arr = byTicker.get(sym) ?? [];
    arr.push(bar);
    byTicker.set(sym, arr);
  }
  for (const arr of byTicker.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
  return byTicker;
}

// ---- Accumulators ----------------------------------------------------------
interface Bucket {
  n: number;
  upHits: number; // predicted-up calls where next session closed up
  retSum: number; // sum of next-session returns for predicted-up calls
}
const mk = (): Bucket => ({ n: 0, upHits: 0, retSum: 0 });

// thresholds on P(up) that count as a "predict up" call
const thresholds = [0.5, 0.52, 0.55, 0.6];
const buckets1d = new Map(thresholds.map((t) => [t, mk()]));
const buckets2d = new Map(thresholds.map((t) => [t, mk()]));

let totalDays = 0;
let upDays1d = 0; // base rate, 1-day
let upDays2d = 0;
let totalReturn1d = 0;
// decile calibration: index by floor(probUp*10)
const decile = Array.from({ length: 11 }, () => ({ n: 0, up: 0 }));

const data = loadByTicker(csvPath);
let tickersUsed = 0;

for (const [sym, bars] of data) {
  if (tickersUsed >= maxTickers) break;
  if (bars.length < WINDOW + 3) continue;
  tickersUsed++;
  const market: Snapshot["market"] = "us";

  // i = "today" (last known close). Predict i+1 (and i+2).
  for (let i = WINDOW - 1; i < bars.length - 2; i++) {
    const window = bars.slice(i - WINDOW + 1, i + 1); // 252 trailing bars incl. i
    const ind = computeIndicators(window);
    const today = bars[i];
    const snapshot: Snapshot = {
      symbol: sym,
      name: sym,
      market,
      currency: "USD",
      price: today.close,
      previousClose: bars[i - 1].close,
      changePct: ((today.close - bars[i - 1].close) / bars[i - 1].close) * 100,
    };

    const { probUp } = shortTermBull(snapshot, ind, window);

    const ret1d = (bars[i + 1].close - today.close) / today.close;
    const ret2d = (bars[i + 2].close - today.close) / today.close;
    const up1d = ret1d > 0;
    const up2d = ret2d > 0;

    totalDays++;
    totalReturn1d += ret1d;
    if (up1d) upDays1d++;
    if (up2d) upDays2d++;

    const d = decile[Math.min(10, Math.floor(probUp * 10))];
    d.n++;
    if (up1d) d.up++;

    for (const t of thresholds) {
      if (probUp >= t) {
        const b1 = buckets1d.get(t)!;
        b1.n++;
        b1.retSum += ret1d;
        if (up1d) b1.upHits++;
        const b2 = buckets2d.get(t)!;
        b2.n++;
        b2.retSum += ret2d;
        if (up2d) b2.upHits++;
      }
    }
  }
}

// ---- Report ----------------------------------------------------------------
const pct = (x: number) => (x * 100).toFixed(2) + "%";
const baseRate1d = upDays1d / totalDays;
const baseRate2d = upDays2d / totalDays;

console.log("\n================ ODTE DIRECTION-MODEL BACKTEST ================");
console.log(`Data:        ${csvPath}`);
console.log(`Tickers:     ${tickersUsed}`);
console.log(`Predictions: ${totalDays.toLocaleString()} (one per ticker-day, walk-forward, no look-ahead)`);
console.log(`Window fed to model: trailing ${WINDOW} sessions (matches live app's 1y fetch)`);
console.log(`\nBaseline ("always predict up"):`);
console.log(`  next-1-day up-rate: ${pct(baseRate1d)}`);
console.log(`  next-2-day up-rate: ${pct(baseRate2d)}`);
console.log(`  avg next-1-day return (all days): ${pct(totalReturn1d / totalDays)}`);

console.log(`\n--- 1-DAY horizon: accuracy of "predict UP when P(up) >= threshold" ---`);
console.log("thresh |   calls   | hit-rate (closed up) | edge vs base | avg next-day ret");
for (const t of thresholds) {
  const b = buckets1d.get(t)!;
  if (!b.n) continue;
  const hit = b.upHits / b.n;
  console.log(
    `${t.toFixed(2)}   | ${String(b.n).padStart(8)} |       ${pct(hit).padStart(7)}        |   ${(
      (hit - baseRate1d) * 100
    ).toFixed(2)}pp   |     ${pct(b.retSum / b.n)}`,
  );
}

console.log(`\n--- 2-DAY horizon ---`);
console.log("thresh |   calls   | hit-rate (closed up) | edge vs base | avg 2-day ret");
for (const t of thresholds) {
  const b = buckets2d.get(t)!;
  if (!b.n) continue;
  const hit = b.upHits / b.n;
  console.log(
    `${t.toFixed(2)}   | ${String(b.n).padStart(8)} |       ${pct(hit).padStart(7)}        |   ${(
      (hit - baseRate2d) * 100
    ).toFixed(2)}pp   |     ${pct(b.retSum / b.n)}`,
  );
}

console.log(`\n--- CONTRARIAN check: predict UP when P(up) <= threshold (fade the model) ---`);
console.log("thresh |   calls   | hit-rate (closed up) | edge vs base | avg next-day ret");
for (const t of [0.35, 0.4, 0.45]) {
  const cb = mk();
  // recompute from deciles is lossy; instead reuse stored per-day? We only kept
  // deciles + threshold buckets, so approximate contrarian from deciles:
  for (let k = 0; k < Math.round(t * 10); k++) {
    cb.n += decile[k].n;
    cb.upHits += decile[k].up;
  }
  if (!cb.n) continue;
  const hit = cb.upHits / cb.n;
  console.log(
    `<=${t.toFixed(2)} | ${String(cb.n).padStart(8)} |       ${pct(hit).padStart(7)}        |   ${(
      (hit - baseRate1d) * 100
    ).toFixed(2)}pp   |     (see deciles)`,
  );
}

console.log(`\n--- Calibration: actual next-day up-rate by predicted P(up) decile ---`);
console.log("P(up) bin |   n    | actual up-rate");
for (let k = 0; k <= 10; k++) {
  const d = decile[k];
  if (!d.n) continue;
  const lo = (k / 10).toFixed(2);
  console.log(`  ~${lo}   | ${String(d.n).padStart(7)} |   ${pct(d.up / d.n)}`);
}
console.log("===============================================================\n");
