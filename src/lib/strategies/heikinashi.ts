// Heikin Ashi + Volume Oscillator trend strategy.
//
// Idea: Heikin Ashi candles smooth price into clearer trend runs. We enter when
// the HA trend FLIPS (red→green for long, green→red for short) AND a volume
// oscillator confirms expanding participation — so we're joining a fresh trend
// that real volume is backing, not a low-conviction wiggle.
//
// Shares the StrategySignal shape with the ORB engine so the bot's risk/broker
// plumbing is strategy-agnostic.

import type { Bar5m } from "@/lib/orb/signal";

export interface StrategySignal {
  direction: "long" | "short" | "none";
  factors: { n: number; label: string; ok: boolean; detail: string }[];
  allGo: boolean;
  prob: number; // here: heuristic SIGNAL STRENGTH 0–100 (NOT a claimed win rate)
  entryPrice: number | null;
  reason: string;
}

interface HABar {
  open: number;
  high: number;
  low: number;
  close: number;
}

export function heikinAshi(bars: Bar5m[]): HABar[] {
  const ha: HABar[] = [];
  for (let i = 0; i < bars.length; i++) {
    const o = bars[i].open ?? bars[i].close;
    const haClose = (o + bars[i].high + bars[i].low + bars[i].close) / 4;
    const haOpen = i === 0 ? (o + bars[i].close) / 2 : (ha[i - 1].open + ha[i - 1].close) / 2;
    ha.push({
      open: haOpen,
      close: haClose,
      high: Math.max(bars[i].high, haOpen, haClose),
      low: Math.min(bars[i].low, haOpen, haClose),
    });
  }
  return ha;
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// Volume oscillator = (fastEMA(vol) − slowEMA(vol)) / slowEMA(vol) × 100.
export function volumeOscillator(bars: Bar5m[], fast = 5, slow = 10): number[] {
  const vols = bars.map((b) => b.volume);
  const ef = ema(vols, fast);
  const es = ema(vols, slow);
  return vols.map((_, i) => (es[i] === 0 ? 0 : ((ef[i] - es[i]) / es[i]) * 100));
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function evaluateHeikinAshi(bars: Bar5m[]): StrategySignal {
  if (bars.length < 12) {
    return { direction: "none", factors: [], allGo: false, prob: 0, entryPrice: null, reason: "Not enough bars yet" };
  }
  const ha = heikinAshi(bars);
  const vo = volumeOscillator(bars);
  const n = bars.length - 1;
  const cur = ha[n];
  const prev = ha[n - 1];

  const curGreen = cur.close > cur.open;
  const prevGreen = prev.close > prev.open;
  const bullFlip = curGreen && !prevGreen;
  const bearFlip = !curGreen && prevGreen;
  const volOsc = vo[n];
  const volRising = vo[n] >= vo[n - 1];
  // HA convention: a strong bull candle has little/no lower wick (and vice-versa).
  const body = Math.abs(cur.close - cur.open) || 1e-9;
  const lowerWick = Math.min(cur.open, cur.close) - cur.low;
  const upperWick = cur.high - Math.max(cur.open, cur.close);
  const strongBull = lowerWick <= body * 0.1;
  const strongBear = upperWick <= body * 0.1;

  let direction: StrategySignal["direction"] = "none";
  if (bullFlip && volOsc > 0) direction = "long";
  else if (bearFlip && volOsc > 0) direction = "short";

  const f1 = bullFlip || bearFlip;
  const f2 = volOsc > 0;
  const f3 = volRising;
  const f4 = direction === "long" ? strongBull : direction === "short" ? strongBear : false;

  const factors = [
    { n: 1, label: "Heikin-Ashi trend flip", ok: f1, detail: bullFlip ? "flipped to GREEN (up)" : bearFlip ? "flipped to RED (down)" : `no flip (trend ${curGreen ? "up" : "down"})` },
    { n: 2, label: "Volume oscillator > 0", ok: f2, detail: `osc ${volOsc.toFixed(1)}% (volume ${volOsc > 0 ? "expanding" : "contracting"})` },
    { n: 3, label: "Volume momentum rising", ok: f3, detail: `${vo[n].toFixed(1)}% vs ${vo[n - 1].toFixed(1)}% prior` },
    { n: 4, label: "Candle conviction (no opposing wick)", ok: f4, detail: f4 ? "clean trend candle" : "wick against the move" },
  ];

  const allGo = direction !== "none" && f1 && f2;
  const strength = clamp(40 + (f2 ? 12 : 0) + (f3 ? 12 : 0) + (f4 ? 12 : 0) + clamp(Math.abs(volOsc) / 2, 0, 20), 0, 95);

  return {
    direction,
    factors,
    allGo,
    prob: allGo ? Math.round(strength) : 0,
    entryPrice: allGo ? bars[n].close : null,
    reason: allGo
      ? `GO ${direction.toUpperCase()} — HA flip + volume`
      : !f1
        ? "No Heikin-Ashi trend flip this bar"
        : !f2
          ? "Trend flipped but volume not expanding (osc ≤ 0)"
          : "No entry",
  };
}
