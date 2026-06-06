// Pure-function technical indicators. No external deps so they are easy to
// reason about and unit-test. All operate on arrays of numbers (usually
// closes) ordered oldest -> newest.

import type { OHLC, Indicators } from "@/lib/types";

export function sma(values: number[], period: number): number | undefined {
  if (values.length < period) return undefined;
  const slice = values.slice(values.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Exponential moving average over the whole series; returns the final value.
export function ema(values: number[], period: number): number | undefined {
  if (values.length < period) return undefined;
  const k = 2 / (period + 1);
  // seed with SMA of first `period` values
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

// Full EMA series (same length as input, undefined until enough data).
function emaSeries(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    if (i === period - 1) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

// Wilder's RSI.
export function rsi(values: number[], period = 14): number | undefined {
  if (values.length < period + 1) return undefined;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface MACDResult {
  macd: number;
  signal: number;
  hist: number;
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MACDResult | undefined {
  if (values.length < slow + signalPeriod) return undefined;
  const fastE = emaSeries(values, fast);
  const slowE = emaSeries(values, slow);
  const macdLine = values.map((_, i) =>
    isNaN(fastE[i]) || isNaN(slowE[i]) ? NaN : fastE[i] - slowE[i],
  );
  const valid = macdLine.filter((v) => !isNaN(v));
  const signalE = emaSeries(valid, signalPeriod);
  const macdVal = valid[valid.length - 1];
  const signalVal = signalE[signalE.length - 1];
  return { macd: macdVal, signal: signalVal, hist: macdVal - signalVal };
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function bollinger(values: number[], period = 20, mult = 2) {
  if (values.length < period) return undefined;
  const slice = values.slice(values.length - period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const sd = stdev(slice);
  return { upper: mid + mult * sd, lower: mid - mult * sd, mid };
}

// Average True Range (Wilder).
export function atr(bars: OHLC[], period = 14): number | undefined {
  if (bars.length < period + 1) return undefined;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const pc = bars[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  // Wilder smoothing
  let prev = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    prev = (prev * (period - 1) + trs[i]) / period;
  }
  return prev;
}

// Daily log returns.
export function logReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    out.push(Math.log(values[i] / values[i - 1]));
  }
  return out;
}

// Annualised historical volatility from the last `window` daily returns.
export function historicalVol(closes: number[], window = 20): number {
  const rets = logReturns(closes);
  if (rets.length < window) return stdev(rets) * Math.sqrt(252);
  const recent = rets.slice(rets.length - window);
  return stdev(recent) * Math.sqrt(252);
}

function pctChange(closes: number[], lookback: number): number | undefined {
  if (closes.length <= lookback) return undefined;
  const now = closes[closes.length - 1];
  const then = closes[closes.length - 1 - lookback];
  return (now / then - 1) * 100;
}

export function computeIndicators(bars: OHLC[]): Indicators {
  const closes = bars.map((b) => b.adjClose || b.close);
  const last = closes[closes.length - 1];
  const bb = bollinger(closes, 20, 2);
  const m = macd(closes);
  const atr14 = atr(bars, 14);
  const high52 = Math.max(...closes.slice(-252));
  const low52 = Math.min(...closes.slice(-252));

  return {
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    ema12: ema(closes, 12),
    ema26: ema(closes, 26),
    rsi14: rsi(closes, 14),
    macd: m?.macd,
    macdSignal: m?.signal,
    macdHist: m?.hist,
    bbUpper: bb?.upper,
    bbLower: bb?.lower,
    bbMid: bb?.mid,
    atr14,
    atrPct: atr14 ? (atr14 / last) * 100 : undefined,
    hv20: historicalVol(closes, 20) * 100,
    return1m: pctChange(closes, 21),
    return3m: pctChange(closes, 63),
    return6m: pctChange(closes, 126),
    distFrom52wHigh: high52 ? (last / high52 - 1) * 100 : undefined,
    distFrom52wLow: low52 ? (last / low52 - 1) * 100 : undefined,
  };
}
