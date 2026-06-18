// Fully-automated ASX200 ORB signal engine.
//
// Unlike the /orb web page (which takes manual ticks for the intraday legs),
// this computes ALL machine-readable factors directly from market data so a bot
// can run unattended. One deliberate deviation: "AFR article tone" (Factor 1's
// fifth leg) has no reliable free feed, so the automated gate uses the THREE
// quantifiable macro legs and requires >=2 aligned — the same reduced proxy the
// macro backtest uses. This is documented in AUTOMATION.md.

import { rsi } from "@/lib/analysis/indicators";

export interface Bar5m {
  time: string; // ISO timestamp of the bar OPEN
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OvernightMacro {
  wallStPct: number; // ^GSPC daily %  (also stands in for SPI futures)
  audPct: number; // AUDUSD=X daily %
  ironPct: number; // iron-ore proxy daily % (e.g. BHP)
  nikkeiPct: number; // ^N225 intraday/last %  (Factor 3)
}

export type Dir = "long" | "short" | "none";

export interface SignalResult {
  direction: Dir;
  factors: { n: number; label: string; ok: boolean; detail: string }[];
  allGo: boolean;
  prob: number; // stacked claimed win-rate reached (0 if gate fails)
  orb: { high: number; low: number } | null;
  entryPrice: number | null;
  reason: string;
}

const MACRO_TH = { wallSt: 0.5, aud: 0.3, iron: 0.8 };
const VOL_MULT = 1.4;
const RSI_LONG = [40, 65] as const;
const RSI_SHORT = [35, 60] as const;
const ORB_MINUTES = 30;
const BAR_MINUTES = 5;
const ORB_BARS = ORB_MINUTES / BAR_MINUTES; // 6

const sgn = (x: number): 1 | -1 | 0 => (x > 0 ? 1 : x < 0 ? -1 : 0);
const PROB_STACK = [58, 68, 74, 79, 83];

// Average volume for a given HH:MM across PRIOR sessions in the feed (the
// "average for that time of day over the last 10 sessions" rule).
function avgVolumeAtTimeOfDay(bars: Bar5m[], target: Bar5m, lookbackDays = 10): number {
  const hhmm = target.time.slice(11, 16);
  const targetDay = target.time.slice(0, 10);
  const seen: number[] = [];
  const days = new Set<string>();
  for (let i = bars.length - 1; i >= 0; i--) {
    const b = bars[i];
    const day = b.time.slice(0, 10);
    if (day >= targetDay) continue; // strictly prior sessions, no look-ahead
    if (b.time.slice(11, 16) === hhmm) {
      seen.push(b.volume);
      days.add(day);
    }
    if (days.size >= lookbackDays) break;
  }
  if (!seen.length) return Infinity; // not enough history -> fail the volume test
  return seen.reduce((a, b) => a + b, 0) / seen.length;
}

/**
 * Evaluate the 5-factor ORB signal for the CURRENT ASX session.
 * @param todayBars  5-min bars for today's session, in order (index 0 = 10:00).
 * @param historyBars  5-min bars for prior sessions (for time-of-day vol avg).
 */
export function evaluateSignal(
  todayBars: Bar5m[],
  historyBars: Bar5m[],
  macro: OvernightMacro,
): SignalResult {
  const factors: SignalResult["factors"] = [];

  // ---- Factor 1: overnight macro gate (>=2 of 3 legs aligned) ----
  const legs = [
    { v: macro.wallStPct, th: MACRO_TH.wallSt, name: "Wall St" },
    { v: macro.audPct, th: MACRO_TH.aud, name: "AUD/USD" },
    { v: macro.ironPct, th: MACRO_TH.iron, name: "Iron ore" },
  ];
  const cleared = legs.filter((l) => Math.abs(l.v) >= l.th);
  const vote = cleared.reduce((a, l) => a + sgn(l.v), 0);
  const macroDir = sgn(vote);
  const aligned = cleared.filter((l) => sgn(l.v) === macroDir).length;
  const f1 = macroDir !== 0 && aligned >= 2;
  const direction: Dir = !f1 ? "none" : macroDir === 1 ? "long" : "short";
  factors.push({
    n: 1,
    label: "Overnight macro gate",
    ok: f1,
    detail: `${aligned}/3 legs aligned ${macroDir === 1 ? "up" : macroDir === -1 ? "down" : "—"} (need ≥2)`,
  });

  // Need the opening range before any intraday factor can be judged.
  if (todayBars.length < ORB_BARS) {
    return done(direction, factors, null, null, "Waiting for the 30-min opening range to complete.");
  }
  const orbWindow = todayBars.slice(0, ORB_BARS);
  const orbHigh = Math.max(...orbWindow.map((b) => b.high));
  const orbLow = Math.min(...orbWindow.map((b) => b.low));
  const orb = { high: orbHigh, low: orbLow };

  // ---- Factor 2: first 5-min close beyond the ORB in the macro direction ----
  let breakIdx = -1;
  let breakDir: Dir = "none";
  for (let i = ORB_BARS; i < todayBars.length; i++) {
    if (todayBars[i].close > orbHigh) { breakIdx = i; breakDir = "long"; break; }
    if (todayBars[i].close < orbLow) { breakIdx = i; breakDir = "short"; break; }
  }
  const f2 = breakIdx >= 0 && breakDir === direction;
  factors.push({
    n: 2,
    label: "ORB break confirms",
    ok: f2,
    detail:
      breakIdx < 0
        ? "No 5-min close beyond the range yet"
        : `Broke ${breakDir} ${breakDir === direction ? "(agrees)" : "(against macro — no trade)"}`,
  });
  if (!f2) return done(direction, factors, orb, null, factors[1].detail);

  const breakBar = todayBars[breakIdx];

  // ---- Factor 3: Nikkei aligned ----
  const f3 = direction !== "none" && sgn(macro.nikkeiPct) === macroDir;
  factors.push({
    n: 3,
    label: "Nikkei aligned",
    ok: f3,
    detail: `Nikkei ${macro.nikkeiPct >= 0 ? "+" : ""}${macro.nikkeiPct.toFixed(2)}%`,
  });

  // ---- Factor 4: volume >= 1.4x the time-of-day average ----
  const avgVol = avgVolumeAtTimeOfDay(historyBars, breakBar);
  const f4 = breakBar.volume >= VOL_MULT * avgVol;
  factors.push({
    n: 4,
    label: "Volume ≥1.4× avg",
    ok: f4,
    detail: isFinite(avgVol)
      ? `${(breakBar.volume / avgVol).toFixed(2)}× the 10-day time-of-day avg`
      : "Not enough intraday history for the volume average",
  });

  // ---- Factor 5: 5-min RSI(14) in band at the break ----
  const closes = todayBars.slice(0, breakIdx + 1).map((b) => b.close);
  const histCloses = historyBars.slice(-50).map((b) => b.close);
  const rsiVal = rsi([...histCloses, ...closes], 14);
  const band = direction === "long" ? RSI_LONG : RSI_SHORT;
  const f5 = rsiVal !== undefined && rsiVal >= band[0] && rsiVal <= band[1];
  factors.push({
    n: 5,
    label: "RSI not extreme",
    ok: f5,
    detail: rsiVal === undefined ? "RSI unavailable" : `RSI ${rsiVal.toFixed(1)} (band ${band[0]}–${band[1]})`,
  });

  return done(direction, factors, orb, breakBar.close, "");
}

function done(
  direction: Dir,
  factors: SignalResult["factors"],
  orb: SignalResult["orb"],
  entryPrice: number | null,
  reason: string,
): SignalResult {
  let run = 0;
  for (const f of factors) {
    if (f.ok) run++;
    else break;
  }
  const allGo = factors.length === 5 && factors.every((f) => f.ok) && direction !== "none";
  const firstFail = factors.find((f) => !f.ok);
  return {
    direction,
    factors,
    allGo,
    prob: run === 0 ? 0 : PROB_STACK[run - 1],
    orb,
    entryPrice: allGo ? entryPrice : null,
    reason: allGo ? `GO ${direction.toUpperCase()}` : reason || `Blocked at Factor ${firstFail?.n} — ${firstFail?.label}`,
  };
}
