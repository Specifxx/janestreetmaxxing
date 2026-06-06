// Short-horizon ("0-2 DTE") engine: which names are most likely to close higher
// over the next 1-2 sessions, and — critically — filters out names that have
// ALREADY made their expected up-move overnight / intraday (no edge left).
//
// Probability model is a transparent logistic over short-term factors. This is
// a statistical edge estimate, NOT a guarantee.

import type { Indicators, ODTECandidate, OHLC, Snapshot } from "@/lib/types";

const TRADING_DAYS = 252;

// Logistic squashing function.
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

// Estimate the chance the next session closes up, plus a 0-100 bullish score,
// from short-term technical factors. Weights are hand-tuned priors, not fit —
// they encode well-documented short-horizon tendencies (trend persistence,
// mild mean-reversion from oversold, MACD turns).
function shortTermBull(
  snapshot: Snapshot,
  ind: Indicators,
  history: OHLC[],
): { probUp: number; score: number; signals: string[] } {
  const signals: string[] = [];
  let z = 0;

  const price = snapshot.price;

  // 1. Above short-term trend (SMA20) — persistence.
  if (ind.sma20) {
    if (price > ind.sma20) {
      z += 0.35;
      signals.push("above SMA20 (short trend up)");
    } else {
      z -= 0.3;
      signals.push("below SMA20");
    }
  }

  // 2. MACD histogram turning up.
  if (ind.macdHist != null) {
    z += Math.tanh(ind.macdHist / (price * 0.01)) * 0.4;
    signals.push(ind.macdHist > 0 ? "MACD positive" : "MACD negative");
  }

  // 3. RSI: sweet spot 45-65 is constructive; <30 is an oversold bounce setup;
  //    >75 is exhaustion risk.
  if (ind.rsi14 != null) {
    const r = ind.rsi14;
    if (r >= 45 && r <= 65) {
      z += 0.3;
      signals.push(`RSI ${r.toFixed(0)} (constructive)`);
    } else if (r < 30) {
      z += 0.2;
      signals.push(`RSI ${r.toFixed(0)} (oversold bounce)`);
    } else if (r > 75) {
      z -= 0.45;
      signals.push(`RSI ${r.toFixed(0)} (overbought)`);
    } else {
      signals.push(`RSI ${r.toFixed(0)}`);
    }
  }

  // 4. Recent 1-month drift (annualised-ish momentum).
  if (ind.return1m != null) {
    z += Math.tanh(ind.return1m / 10) * 0.25;
  }

  // 5. Streak / yesterday's close strength — did it close in the upper half of
  //    its daily range? (buyers in control)
  if (history.length >= 2) {
    const y = history[history.length - 1];
    const range = y.high - y.low;
    if (range > 0) {
      const closePos = (y.close - y.low) / range;
      z += (closePos - 0.5) * 0.4;
      if (closePos > 0.7) signals.push("strong close yesterday");
    }
  }

  // 6. Penalise if already extended far above 52w-low band? (light)
  const probUp = sigmoid(z);
  const score = Math.round(probUp * 100);
  return { probUp, score, signals };
}

export function analyzeODTE(
  snapshot: Snapshot,
  ind: Indicators,
  history: OHLC[],
  impliedVol?: number | null,
): ODTECandidate {
  const price = snapshot.price;
  // Daily sigma from implied vol if available, else 20-day historical vol.
  const annualVol = impliedVol && impliedVol > 0 ? impliedVol : (ind.hv20 ?? 30) / 100;
  const dailySigma = annualVol / Math.sqrt(TRADING_DAYS);
  const expectedMovePct = dailySigma * 100; // one-sigma 1-day move, %
  const expectedMove2dPct = expectedMovePct * Math.sqrt(2);

  const { probUp, score, signals } = shortTermBull(snapshot, ind, history);

  // Bullish target for a 1-day trade: ~0.8σ up (a move with realistic odds).
  const bullishTargetPct = +(expectedMovePct * 0.8).toFixed(2);

  // How much of the expected up-move is LEFT after today's move so far.
  const changeToday = snapshot.changePct;
  const headroomPct = +(bullishTargetPct - changeToday).toFixed(2);

  // "Already moved": the name has already run past (most of) its expected
  // up-move overnight/intraday, so the asymmetric entry is gone.
  const alreadyMoved = changeToday >= bullishTargetPct || changeToday >= expectedMovePct;
  if (alreadyMoved) {
    signals.unshift(
      `already +${changeToday.toFixed(1)}% today vs ${bullishTargetPct.toFixed(1)}% target — edge spent`,
    );
  }

  return {
    symbol: snapshot.symbol,
    name: snapshot.name,
    market: snapshot.market,
    price,
    changePctToday: +changeToday.toFixed(2),
    expectedMovePct: +expectedMovePct.toFixed(2),
    expectedMove2dPct: +expectedMove2dPct.toFixed(2),
    impliedVol: impliedVol ?? null,
    histVol: +(ind.hv20 ?? 0).toFixed(1),
    probUp: +probUp.toFixed(3),
    upScore: score,
    headroomPct,
    alreadyMoved,
    signals,
    bullishTargetPct,
  };
}

// Rank candidates: highest probability-of-up first, but only those that still
// have headroom (not already moved) score for the actionable list.
export function rankODTE(cands: ODTECandidate[]): ODTECandidate[] {
  return [...cands].sort((a, b) => {
    if (a.alreadyMoved !== b.alreadyMoved) return a.alreadyMoved ? 1 : -1;
    // composite of probUp and remaining headroom
    const av = a.upScore + Math.max(0, a.headroomPct) * 4;
    const bv = b.upScore + Math.max(0, b.headroomPct) * 4;
    return bv - av;
  });
}
