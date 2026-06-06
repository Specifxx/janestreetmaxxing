// Deterministic synthetic market data. Used as a fallback when the live Yahoo
// endpoints are unreachable (e.g. restricted networks / CI) so the interface
// and the full analysis pipeline remain demonstrable. Clearly flagged as
// `dataSource: "sample"` everywhere in the UI — these are NOT real prices.

import type { Fundamentals, OHLC, Snapshot } from "@/lib/types";
import { US_UNIVERSE, AU_UNIVERSE } from "@/lib/universe";

const NAMES = new Map(
  [...US_UNIVERSE, ...AU_UNIVERSE].map((u) => [u.symbol, u.name]),
);

// Mulberry32 seeded PRNG -> deterministic per symbol.
function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gauss(rand: () => number): number {
  // Box-Muller
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function isAU(symbol: string) {
  return symbol.endsWith(".AX");
}

export function sampleChart(symbol: string, days = 260): { snapshot: Snapshot; history: OHLC[] } {
  const rand = rng(seedFor(symbol));
  const au = isAU(symbol);
  const start = 20 + rand() * 380; // base price
  const driftAnnual = (rand() - 0.35) * 0.5; // bias slightly positive
  const vol = 0.18 + rand() * 0.4; // annualised vol
  const dailyDrift = driftAnnual / 252;
  const dailyVol = vol / Math.sqrt(252);

  const history: OHLC[] = [];
  let price = start;
  const today = new Date("2026-06-05");
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
    const shock = gauss(rand) * dailyVol;
    const ret = dailyDrift + shock;
    const open = price;
    const close = Math.max(0.5, open * (1 + ret));
    const hi = Math.max(open, close) * (1 + Math.abs(gauss(rand)) * dailyVol * 0.6);
    const lo = Math.min(open, close) * (1 - Math.abs(gauss(rand)) * dailyVol * 0.6);
    history.push({
      date: d.toISOString().slice(0, 10),
      open: +open.toFixed(2),
      high: +hi.toFixed(2),
      low: +lo.toFixed(2),
      close: +close.toFixed(2),
      adjClose: +close.toFixed(2),
      volume: Math.round((1 + rand() * 4) * 1_000_000),
    });
    price = close;
  }
  const last = history[history.length - 1];
  const prev = history[history.length - 2] ?? last;
  const snapshot: Snapshot = {
    symbol,
    name: NAMES.get(symbol) ?? symbol,
    market: au ? "au" : "us",
    currency: au ? "AUD" : "USD",
    price: last.close,
    previousClose: prev.close,
    open: last.open,
    dayHigh: last.high,
    dayLow: last.low,
    changePct: ((last.close - prev.close) / prev.close) * 100,
    exchange: au ? "ASX" : "NMS",
  };
  return { snapshot, history };
}

export function sampleFundamentals(symbol: string): Fundamentals {
  const rand = rng(seedFor(symbol) ^ 0x9e3779b9);
  const { snapshot } = sampleChart(symbol);
  const price = snapshot.price;
  const eps = price / (12 + rand() * 30); // implied P/E 12-42
  const growth = (rand() - 0.2) * 0.4; // -8%..+32%
  const shares = (200 + rand() * 4000) * 1e6;
  const fcfPerShare = eps * (0.6 + rand() * 0.8);
  return {
    currency: snapshot.currency,
    marketCap: price * shares,
    trailingPE: price / eps,
    forwardPE: price / (eps * (1 + Math.max(0, growth))),
    pegRatio: growth > 0 ? price / eps / (growth * 100) : undefined,
    priceToBook: 1.5 + rand() * 6,
    trailingEps: +eps.toFixed(2),
    forwardEps: +(eps * (1 + Math.max(0, growth))).toFixed(2),
    beta: +(0.7 + rand() * 1.3).toFixed(2),
    bookValue: +(price / (2 + rand() * 6)).toFixed(2),
    sharesOutstanding: shares,
    dividendYield: rand() * 0.04,
    freeCashflow: fcfPerShare * shares,
    operatingCashflow: fcfPerShare * shares * 1.2,
    totalCash: price * shares * (0.03 + rand() * 0.1),
    totalDebt: price * shares * (0.05 + rand() * 0.25),
    ebitda: eps * shares * (1.4 + rand()),
    revenueGrowth: +growth.toFixed(3),
    earningsGrowth: +(growth * (0.8 + rand() * 0.6)).toFixed(3),
    returnOnEquity: +(0.05 + rand() * 0.3).toFixed(3),
    profitMargins: +(0.05 + rand() * 0.3).toFixed(3),
    targetMeanPrice: +(price * (0.9 + rand() * 0.4)).toFixed(2),
    targetHighPrice: +(price * (1.2 + rand() * 0.3)).toFixed(2),
    targetLowPrice: +(price * (0.7 + rand() * 0.2)).toFixed(2),
    recommendationMean: +(1.6 + rand() * 2.6).toFixed(1),
    numberOfAnalysts: Math.round(5 + rand() * 40),
    fiftyDayAverage: price * (0.95 + rand() * 0.1),
    twoHundredDayAverage: price * (0.9 + rand() * 0.2),
    fiftyTwoWeekHigh: price * (1.05 + rand() * 0.3),
    fiftyTwoWeekLow: price * (0.5 + rand() * 0.3),
    averageVolume: Math.round((1 + rand() * 5) * 1_000_000),
  };
}

export function sampleAtmIV(symbol: string): number {
  const rand = rng(seedFor(symbol) ^ 0x1234567);
  return +(0.2 + rand() * 0.6).toFixed(3); // 20%..80% IV
}
