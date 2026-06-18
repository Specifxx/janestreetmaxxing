// Head-to-head backtest: run two strategies over the SAME 5-min history with an
// identical, leverage-agnostic paper position model, so the comparison is fair.
//
// Exit model (shared): on entry, set a fixed bracket — stop at −stopPct and
// target at +targetPct of the underlying price — and resolve against subsequent
// bars (stop checked first = conservative). Trades never overlap. Results are in
// UNDERLYING % (no leverage), so it measures signal quality; leverage would
// scale both strategies equally.

import { evaluateSignal, type Bar5m, type OvernightMacro } from "@/lib/orb/signal";
import { evaluateHeikinAshi, type StrategySignal } from "@/lib/strategies/heikinashi";

export interface StratStats {
  name: string;
  trades: number;
  wins: number;
  winRatePct: number;
  avgReturnPct: number; // per trade
  expectancyPct: number; // == avgReturnPct (kept explicit)
  totalReturnPct: number; // compounded
  maxDrawdownPct: number;
}

const STOP_PCT = 0.4;
const TARGET_PCT = 0.6;
const HORIZON = 30; // bars to let a trade resolve (~2.5h on 5-min)
const WARMUP = 60;

type SignalAt = (bars: Bar5m[], i: number) => StrategySignal;

// ORB needs day grouping + an overnight-macro direction. Historically we can't
// pull point-in-time macro, so we proxy it with the ASX200's own OVERNIGHT GAP
// (today's first open vs the prior session's last close) — the market's actual
// overnight repricing. Documented as a proxy.
function macroFromGap(gapPct: number): OvernightMacro {
  return { wallStPct: gapPct, audPct: gapPct, ironPct: gapPct, nikkeiPct: gapPct };
}

export const orbSignalAt: SignalAt = (bars, i) => {
  const day = bars[i].time.slice(0, 10);
  let start = i;
  while (start > 0 && bars[start - 1].time.slice(0, 10) === day) start--;
  if (start === 0) return noSig(); // need a prior session for the gap
  const prevClose = bars[start - 1].close;
  const firstOpen = bars[start].open ?? bars[start].close;
  const gap = ((firstOpen - prevClose) / prevClose) * 100;
  const today = bars.slice(start, i + 1);
  const history = bars.slice(Math.max(0, start - 600), start);
  return evaluateSignal(today, history, macroFromGap(gap)) as StrategySignal;
};

export const haSignalAt: SignalAt = (bars, i) =>
  evaluateHeikinAshi(bars.slice(Math.max(0, i - 300), i + 1));

function noSig(): StrategySignal {
  return { direction: "none", factors: [], allGo: false, prob: 0, entryPrice: null, reason: "" };
}

function resolveBracket(
  bars: Bar5m[],
  entryIdx: number,
  dir: "long" | "short",
  entry: number,
): { ret: number; exitIdx: number } {
  const long = dir === "long";
  const stopP = long ? entry * (1 - STOP_PCT / 100) : entry * (1 + STOP_PCT / 100);
  const tgtP = long ? entry * (1 + TARGET_PCT / 100) : entry * (1 - TARGET_PCT / 100);
  const end = Math.min(bars.length - 1, entryIdx + HORIZON);
  for (let j = entryIdx + 1; j <= end; j++) {
    const b = bars[j];
    if (long) {
      if (b.low <= stopP) return { ret: -STOP_PCT / 100, exitIdx: j };
      if (b.high >= tgtP) return { ret: TARGET_PCT / 100, exitIdx: j };
    } else {
      if (b.high >= stopP) return { ret: -STOP_PCT / 100, exitIdx: j };
      if (b.low <= tgtP) return { ret: TARGET_PCT / 100, exitIdx: j };
    }
  }
  // neither hit within horizon → mark to market
  const last = bars[end].close;
  const ret = long ? (last - entry) / entry : (entry - last) / entry;
  return { ret, exitIdx: end };
}

function backtest(name: string, bars: Bar5m[], signalAt: SignalAt): StratStats {
  const rets: number[] = [];
  let i = WARMUP;
  while (i < bars.length) {
    const sig = signalAt(bars, i);
    if (sig.allGo && sig.direction !== "none" && sig.entryPrice != null) {
      const { ret, exitIdx } = resolveBracket(bars, i, sig.direction, bars[i].close);
      rets.push(ret);
      i = exitIdx + 1; // no overlapping trades
    } else {
      i++;
    }
  }
  const trades = rets.length;
  const wins = rets.filter((r) => r > 0).length;
  let equity = 1, peak = 1, maxDD = 0;
  for (const r of rets) {
    equity *= 1 + r;
    if (equity > peak) peak = equity;
    maxDD = Math.max(maxDD, (peak - equity) / peak);
  }
  const avg = trades ? rets.reduce((a, b) => a + b, 0) / trades : 0;
  return {
    name,
    trades,
    wins,
    winRatePct: trades ? (wins / trades) * 100 : 0,
    avgReturnPct: avg * 100,
    expectancyPct: avg * 100,
    totalReturnPct: (equity - 1) * 100,
    maxDrawdownPct: maxDD * 100,
  };
}

export function runComparison(bars: Bar5m[]): {
  orb: StratStats;
  heikinashi: StratStats;
  bars: number;
  days: number;
  params: { stopPct: number; targetPct: number; horizonBars: number };
} {
  const days = new Set(bars.map((b) => b.time.slice(0, 10))).size;
  return {
    orb: backtest("ASX200 ORB", bars, orbSignalAt),
    heikinashi: backtest("Heikin Ashi + Vol Osc", bars, haSignalAt),
    bars: bars.length,
    days,
    params: { stopPct: STOP_PCT, targetPct: TARGET_PCT, horizonBars: HORIZON },
  };
}
