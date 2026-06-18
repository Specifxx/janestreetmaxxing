/*
 * Monte Carlo stress-test of the ASX200 ORB compounding plan.
 *
 * This does NOT prove the strategy's win rate (that needs years of intraday
 * 5-min data we don't have). It answers a different, equally important question:
 *
 *   "IF the win rate is X, does the $100 -> $1,000,000 / 20x plan actually
 *    hold up — and how fragile is it to the win-rate assumption?"
 *
 * The trade model is fixed-fractional full compounding (bet the whole account
 * each trade), matching the user-supplied spec:
 *   - loss:        -20.2% net   (20x leverage x 1.0% stop, after costs)
 *   - base win:    +14.509% net (20x x 0.735% TP)
 *   - runner win:  +59.8% net   (20x x 3.0% TP), on a fraction of wins
 *   - 20 trades/year x 4 years = 80 trades
 *
 * Sanity check (deterministic): 57 base + 10 runner + 13 loss from $100
 *   = 100 * 1.14509^57 * 1.598^10 * 0.798^13 ≈ $1.31m  (matches the spec).
 *
 * Usage:  npx tsx scripts/orb-montecarlo.ts [sims] [winRate]
 */

const SIMS = Number(process.argv[2]) || 100_000;
const CLI_WIN = process.argv[3] ? Number(process.argv[3]) : undefined;

// ---- Plan parameters (the user's spec) ------------------------------------
const START = 100;
const TARGET = 1_000_000;
const TRADES = 80; // 20/yr * 4yr
const LOSS = -0.202; // net per losing trade
const BASE_WIN = 0.14509; // net per base-win trade
const RUNNER_WIN = 0.598; // net per runner-win trade
const RUNNER_SHARE = 10 / 67; // fraction of WINS that run to the 3% target (~0.149)

// Deterministic RNG (mulberry32) so results are reproducible.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function pctile(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

interface Result {
  winRate: number;
  pHitTargetEnd: number; // final equity >= $1M
  pEverTarget: number; // touched $1M at any point
  medianFinal: number;
  medianMaxDD: number;
  worstMaxDD: number; // 95th-percentile drawdown
  pLoseMoney: number; // final < start
  pWiped: number; // final < 10% of start (margin-call territory)
}

function simulate(winRate: number, sims: number): Result {
  const rnd = rng(0x9e3779b1 ^ Math.round(winRate * 1e6));
  const finals: number[] = [];
  const maxDDs: number[] = [];
  let hitEnd = 0,
    ever = 0,
    lose = 0,
    wiped = 0;

  for (let s = 0; s < sims; s++) {
    let eq = START;
    let peak = START;
    let maxDD = 0;
    let touched = false;
    for (let t = 0; t < TRADES; t++) {
      let r: number;
      if (rnd() < winRate) {
        r = rnd() < RUNNER_SHARE ? RUNNER_WIN : BASE_WIN;
      } else {
        r = LOSS;
      }
      eq *= 1 + r;
      if (eq > peak) peak = eq;
      const dd = (peak - eq) / peak;
      if (dd > maxDD) maxDD = dd;
      if (eq >= TARGET) touched = true;
    }
    finals.push(eq);
    maxDDs.push(maxDD);
    if (eq >= TARGET) hitEnd++;
    if (touched) ever++;
    if (eq < START) lose++;
    if (eq < START * 0.1) wiped++;
  }

  return {
    winRate,
    pHitTargetEnd: hitEnd / sims,
    pEverTarget: ever / sims,
    medianFinal: median(finals),
    medianMaxDD: median(maxDDs),
    worstMaxDD: pctile(maxDDs, 0.95),
    pLoseMoney: lose / sims,
    pWiped: wiped / sims,
  };
}

// ---- Run -------------------------------------------------------------------
const pct = (x: number) => (x * 100).toFixed(1) + "%";
const money = (x: number) =>
  x >= 1e6 ? `$${(x / 1e6).toFixed(2)}m` : x >= 1e3 ? `$${(x / 1e3).toFixed(1)}k` : `$${x.toFixed(0)}`;

console.log("\n=========== ASX200 ORB PLAN — MONTE CARLO STRESS TEST ===========");
console.log(`Start ${money(START)} -> target ${money(TARGET)} | ${TRADES} trades | ${SIMS.toLocaleString()} sims`);
console.log(`Per-trade: loss ${pct(LOSS)}, base win +${pct(BASE_WIN)}, runner +${pct(RUNNER_WIN)} (runner=${pct(RUNNER_SHARE)} of wins)`);
console.log(`Sizing: fixed-fractional FULL compounding (whole account every trade), 20x leverage\n`);

const winRates = CLI_WIN ? [CLI_WIN] : [0.8333, 0.78, 0.74, 0.7, 0.65, 0.6, 0.55, 0.5];

console.log("win rate | P(reach $1m) | P(ever $1m) | median final | median maxDD | 95th maxDD | P(lose money) | P(wiped <-90%)");
console.log("---------|--------------|-------------|--------------|--------------|------------|---------------|----------------");
for (const w of winRates) {
  const r = simulate(w, SIMS);
  console.log(
    `${pct(w).padStart(7)}  |   ${pct(r.pHitTargetEnd).padStart(7)}    |  ${pct(r.pEverTarget).padStart(7)}   |   ${money(
      r.medianFinal,
    ).padStart(8)}   |    ${pct(r.medianMaxDD).padStart(6)}    |   ${pct(r.worstMaxDD).padStart(6)}  |    ${pct(
      r.pLoseMoney,
    ).padStart(6)}     |     ${pct(r.pWiped).padStart(6)}`,
  );
}
console.log("\nNotes:");
console.log("- 'P(reach $1m)' = final equity >= $1m after all 80 trades.");
console.log("- 'maxDD' = peak-to-trough equity drawdown within a path.");
console.log("- Win rate is the ONLY input changed across rows. Everything else is held at the spec.");
console.log("- This assumes the claimed per-trade edge is REAL. It is an unvalidated assumption.\n");
console.log("=================================================================\n");

export {};
