// Composite opportunity score. Combines five orthogonal factor buckets into a
// single 0-100 score and a recommendation label. Each component is documented
// so the UI can show *why* a stock scores the way it does.

import type {
  Fundamentals,
  Indicators,
  PriceTargets,
  ScoreComponent,
  Recommendation,
  Snapshot,
} from "@/lib/types";

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

// Map a value linearly from [inLo,inHi] to [0,100].
function lin(v: number, inLo: number, inHi: number): number {
  return clamp(((v - inLo) / (inHi - inLo)) * 100);
}

// ---- Value (undervaluation vs blended fair value + cheap multiples) -------
function valueScore(f: Fundamentals, pt: PriceTargets): ScoreComponent {
  let score = 50;
  const bits: string[] = [];
  if (pt.upsidePct != null) {
    // +50% upside -> 100, -50% -> 0
    score = lin(pt.upsidePct, -50, 50);
    bits.push(`${pt.upsidePct >= 0 ? "+" : ""}${pt.upsidePct.toFixed(0)}% to fair value`);
  }
  // Nudge for cheap/expensive PE & PEG.
  if (f.forwardPE && f.forwardPE > 0) {
    if (f.forwardPE < 15) {
      score += 6;
      bits.push(`fwd P/E ${f.forwardPE.toFixed(1)} (cheap)`);
    } else if (f.forwardPE > 40) {
      score -= 8;
      bits.push(`fwd P/E ${f.forwardPE.toFixed(1)} (rich)`);
    }
  }
  if (f.pegRatio && f.pegRatio > 0 && f.pegRatio < 1) {
    score += 5;
    bits.push(`PEG ${f.pegRatio.toFixed(2)} < 1`);
  }
  return {
    label: "Value",
    score: clamp(score),
    weight: 0.3,
    detail: bits.join(" · ") || "neutral valuation",
  };
}

// ---- Momentum (trend + RSI + recent returns) ------------------------------
function momentumScore(ind: Indicators, price: number): ScoreComponent {
  let score = 50;
  const bits: string[] = [];
  if (ind.sma50 && ind.sma200) {
    if (price > ind.sma50 && ind.sma50 > ind.sma200) {
      score += 18;
      bits.push("price > SMA50 > SMA200 (uptrend)");
    } else if (price < ind.sma50 && ind.sma50 < ind.sma200) {
      score -= 18;
      bits.push("downtrend (price < SMA50 < SMA200)");
    }
  }
  if (ind.return3m != null) {
    score += clamp(ind.return3m, -15, 15) * 0.6;
    bits.push(`3m ${ind.return3m >= 0 ? "+" : ""}${ind.return3m.toFixed(0)}%`);
  }
  if (ind.rsi14 != null) {
    if (ind.rsi14 > 70) {
      score -= 6;
      bits.push(`RSI ${ind.rsi14.toFixed(0)} (overbought)`);
    } else if (ind.rsi14 < 35) {
      score -= 2; // weak, but can be a reversal setup
      bits.push(`RSI ${ind.rsi14.toFixed(0)} (oversold)`);
    } else {
      bits.push(`RSI ${ind.rsi14.toFixed(0)}`);
    }
  }
  return {
    label: "Momentum",
    score: clamp(score),
    weight: 0.25,
    detail: bits.join(" · ") || "neutral momentum",
  };
}

// ---- Quality (profitability + balance sheet) ------------------------------
function qualityScore(f: Fundamentals): ScoreComponent {
  let score = 50;
  const bits: string[] = [];
  if (f.returnOnEquity != null) {
    score += clamp(f.returnOnEquity * 100, -10, 30) * 0.8;
    bits.push(`ROE ${(f.returnOnEquity * 100).toFixed(0)}%`);
  }
  if (f.profitMargins != null) {
    score += clamp(f.profitMargins * 100, -10, 25) * 0.5;
    bits.push(`margin ${(f.profitMargins * 100).toFixed(0)}%`);
  }
  if (f.totalDebt != null && f.ebitda && f.ebitda > 0) {
    const lev = f.totalDebt / f.ebitda;
    if (lev > 4) {
      score -= 10;
      bits.push(`Debt/EBITDA ${lev.toFixed(1)} (levered)`);
    } else if (lev < 1.5) {
      score += 6;
      bits.push(`Debt/EBITDA ${lev.toFixed(1)} (sturdy)`);
    }
  }
  return {
    label: "Quality",
    score: clamp(score),
    weight: 0.2,
    detail: bits.join(" · ") || "limited fundamentals",
  };
}

// ---- Technicals (MACD, Bollinger position, distance from 52w high) --------
function technicalScore(ind: Indicators, price: number): ScoreComponent {
  let score = 50;
  const bits: string[] = [];
  if (ind.macdHist != null) {
    if (ind.macdHist > 0) {
      score += 10;
      bits.push("MACD bullish");
    } else {
      score -= 8;
      bits.push("MACD bearish");
    }
  }
  if (ind.bbUpper && ind.bbLower) {
    const pos = (price - ind.bbLower) / (ind.bbUpper - ind.bbLower);
    if (pos < 0.2) {
      score += 8;
      bits.push("near lower Bollinger (stretched down)");
    } else if (pos > 0.95) {
      score -= 6;
      bits.push("riding upper Bollinger (extended)");
    }
  }
  if (ind.distFrom52wHigh != null && ind.distFrom52wHigh > -5) {
    score += 5;
    bits.push("near 52w high (strength)");
  }
  return {
    label: "Technicals",
    score: clamp(score),
    weight: 0.15,
    detail: bits.join(" · ") || "neutral technicals",
  };
}

// ---- Sentiment / analyst conviction ---------------------------------------
function sentimentScore(
  f: Fundamentals,
  social?: { score: number; detail: string },
): ScoreComponent {
  let score = 50;
  const bits: string[] = [];
  if (f.recommendationMean != null) {
    // 1 = strong buy, 5 = sell -> invert to 0..100
    score = lin(5 - f.recommendationMean, 0, 4);
    bits.push(`analyst rec ${f.recommendationMean.toFixed(1)}/5`);
  }
  if (social) {
    score = score * 0.7 + social.score * 0.3;
    bits.push(social.detail);
  }
  return {
    label: "Sentiment",
    score: clamp(score),
    weight: 0.1,
    detail: bits.join(" · ") || "no coverage",
  };
}

export function buildComponents(
  f: Fundamentals,
  ind: Indicators,
  pt: PriceTargets,
  snapshot: Snapshot,
  social?: { score: number; detail: string },
): ScoreComponent[] {
  return [
    valueScore(f, pt),
    momentumScore(ind, snapshot.price),
    qualityScore(f),
    technicalScore(ind, snapshot.price),
    sentimentScore(f, social),
  ];
}

export function composite(components: ScoreComponent[]): number {
  const wSum = components.reduce((a, c) => a + c.weight, 0);
  const s = components.reduce((a, c) => a + c.score * c.weight, 0);
  return clamp(s / wSum);
}

export function recommend(score: number, upsidePct: number | null): Recommendation {
  // Upside acts as a gate: don't say "Buy" something with no headroom.
  const up = upsidePct ?? 0;
  if (score >= 78 && up > 12) return "Strong Buy";
  if (score >= 68 && up > 5) return "Buy";
  if (score >= 58) return "Accumulate";
  if (score >= 45) return "Hold";
  if (score >= 35) return "Reduce";
  return "Avoid";
}
