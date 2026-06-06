// Orchestration: pulls data (live Yahoo, falling back to deterministic sample
// data when the network is unavailable) and runs it through the analysis
// pipeline to produce full StockAnalysis objects, screen rows, and ODTE rows.

import type {
  StockAnalysis,
  ScreenResult,
  ODTECandidate,
  Market,
  OHLC,
  Snapshot,
  Fundamentals,
} from "@/lib/types";
import { fetchChart, fetchFundamentals, fetchAtmIV } from "@/lib/providers/yahoo";
import { sampleChart, sampleFundamentals, sampleAtmIV } from "@/lib/providers/sample";
import { fetchRedditBuzz, type SocialBuzz } from "@/lib/providers/reddit";
import { computeIndicators } from "@/lib/analysis/indicators";
import { buildValuations, blendPriceTargets } from "@/lib/analysis/valuation";
import { buildComponents, composite, recommend } from "@/lib/analysis/score";
import { analyzeODTE } from "@/lib/analysis/odte";
import { universeFor } from "@/lib/universe";

// Run an async mapper over items with a bounded concurrency pool.
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

interface RawData {
  snapshot: Snapshot;
  history: OHLC[];
  fundamentals: Fundamentals;
  iv: number | null;
  dataSource: "live" | "sample";
}

// Fetch all raw inputs for a symbol, falling back to sample data on failure.
async function loadRaw(symbol: string, withOptions = false): Promise<RawData> {
  try {
    const [{ snapshot, history }, fundamentals] = await Promise.all([
      fetchChart(symbol),
      fetchFundamentals(symbol).catch(() => sampleFundamentals(symbol)),
    ]);
    if (!history.length) throw new Error("empty history");
    let iv: number | null = null;
    if (withOptions) iv = await fetchAtmIV(symbol).catch(() => null);
    return { snapshot, history, fundamentals, iv, dataSource: "live" };
  } catch {
    const { snapshot, history } = sampleChart(symbol);
    return {
      snapshot,
      history,
      fundamentals: sampleFundamentals(symbol),
      iv: withOptions ? sampleAtmIV(symbol) : null,
      dataSource: "sample",
    };
  }
}

function socialFor(
  symbol: string,
  buzz: Map<string, SocialBuzz> | null,
): { score: number; detail: string } | undefined {
  if (!buzz) return undefined;
  const root = symbol.replace(/\.AX$/, "");
  const b = buzz.get(root);
  if (!b) return undefined;
  return {
    score: b.score,
    detail: `Reddit: ${b.mentions} mentions, ${(b.bullishPct * 100).toFixed(0)}% bullish`,
  };
}

function buildReasoning(
  a: Omit<StockAnalysis, "reasoning" | "risks">,
): { reasoning: string[]; risks: string[] } {
  const reasoning: string[] = [];
  const risks: string[] = [];
  const { snapshot, priceTargets, indicators: ind, components, fundamentals: f } = a;
  const ccy = snapshot.currency;

  if (priceTargets.base != null && priceTargets.upsidePct != null) {
    reasoning.push(
      `Blended fair value ${ccy} ${priceTargets.base.toFixed(2)} vs price ${ccy} ${snapshot.price.toFixed(
        2,
      )} → ${priceTargets.upsidePct >= 0 ? "+" : ""}${priceTargets.upsidePct.toFixed(0)}% to base target.`,
    );
  }
  // Lead with the strongest component.
  const sorted = [...components].sort((x, y) => y.score - x.score);
  reasoning.push(`Strongest factor — ${sorted[0].label} (${sorted[0].score.toFixed(0)}/100): ${sorted[0].detail}.`);
  if (ind.sma50 && ind.sma200) {
    reasoning.push(
      snapshot.price > ind.sma50 && ind.sma50 > ind.sma200
        ? "Trend structure is bullish (price > 50d > 200d MA)."
        : "Trend structure is not yet bullish.",
    );
  }
  if (f.recommendationMean != null) {
    reasoning.push(
      `Sell-side consensus ${f.recommendationMean.toFixed(1)}/5 across ${f.numberOfAnalysts ?? "?"} analysts.`,
    );
  }

  // Risks
  const weakest = sorted[sorted.length - 1];
  risks.push(`Weakest factor — ${weakest.label} (${weakest.score.toFixed(0)}/100): ${weakest.detail}.`);
  if (ind.rsi14 != null && ind.rsi14 > 70) risks.push(`RSI ${ind.rsi14.toFixed(0)} — overbought, pullback risk.`);
  if (f.forwardPE && f.forwardPE > 40) risks.push(`Rich forward P/E (${f.forwardPE.toFixed(0)}×) leaves little room for misses.`);
  if (f.totalDebt && f.ebitda && f.totalDebt / f.ebitda > 4)
    risks.push(`Elevated leverage (Debt/EBITDA ${(f.totalDebt / f.ebitda).toFixed(1)}×).`);
  if (f.nextEarningsDate) risks.push(`Earnings near ${f.nextEarningsDate} — event risk.`);
  if (a.dataSource === "sample") risks.push("Sample data — live market feed was unavailable.");
  return { reasoning, risks };
}

export async function analyzeSymbol(symbol: string): Promise<StockAnalysis> {
  const raw = await loadRaw(symbol, false);
  const indicators = computeIndicators(raw.history);
  const valuations = buildValuations(raw.fundamentals);
  const priceTargets = blendPriceTargets(valuations, raw.snapshot, indicators);

  let buzz: Map<string, SocialBuzz> | null = null;
  try {
    buzz = await fetchRedditBuzz(raw.snapshot.market);
  } catch {
    buzz = null;
  }
  const social = socialFor(symbol, buzz);

  const components = buildComponents(raw.fundamentals, indicators, priceTargets, raw.snapshot, social);
  const compositeScore = composite(components);
  const recommendation = recommend(compositeScore, priceTargets.upsidePct);

  const partial: Omit<StockAnalysis, "reasoning" | "risks"> = {
    snapshot: raw.snapshot,
    fundamentals: raw.fundamentals,
    indicators,
    history: raw.history,
    valuations,
    priceTargets,
    components,
    compositeScore,
    recommendation,
    dataSource: raw.dataSource,
  };
  const { reasoning, risks } = buildReasoning(partial);
  return { ...partial, reasoning, risks };
}

export async function screenMarket(
  market: Market | "all",
  limit = 50,
): Promise<ScreenResult[]> {
  const universe = universeFor(market).slice(0, limit);
  const rows = await mapPool(universe, 6, async (u) => {
    const raw = await loadRaw(u.symbol, false);
    const indicators = computeIndicators(raw.history);
    const valuations = buildValuations(raw.fundamentals);
    const priceTargets = blendPriceTargets(valuations, raw.snapshot, indicators);
    const components = buildComponents(raw.fundamentals, indicators, priceTargets, raw.snapshot);
    const compositeScore = composite(components);
    const recommendation = recommend(compositeScore, priceTargets.upsidePct);
    const top = [...components].sort((a, b) => b.score - a.score)[0];
    const row: ScreenResult = {
      symbol: raw.snapshot.symbol,
      name: raw.snapshot.name,
      market: raw.snapshot.market,
      price: raw.snapshot.price,
      changePct: raw.snapshot.changePct,
      compositeScore,
      recommendation,
      upsidePct: priceTargets.upsidePct,
      rsi14: indicators.rsi14,
      targetBase: priceTargets.base,
      topReason: `${top.label}: ${top.detail}`,
      dataSource: raw.dataSource,
    };
    return row;
  });
  return rows.sort((a, b) => b.compositeScore - a.compositeScore);
}

export async function odteMarket(market: Market | "all"): Promise<{
  actionable: ODTECandidate[];
  alreadyMoved: ODTECandidate[];
  dataSource: "live" | "sample";
}> {
  const universe = universeFor(market);
  let anyLive = false;
  const cands = await mapPool(universe, 5, async (u) => {
    const raw = await loadRaw(u.symbol, true);
    if (raw.dataSource === "live") anyLive = true;
    const indicators = computeIndicators(raw.history);
    return analyzeODTE(raw.snapshot, indicators, raw.history, raw.iv);
  });
  const actionable = cands
    .filter((c) => !c.alreadyMoved)
    .sort((a, b) => b.upScore + Math.max(0, b.headroomPct) * 4 - (a.upScore + Math.max(0, a.headroomPct) * 4));
  const alreadyMoved = cands.filter((c) => c.alreadyMoved).sort((a, b) => b.changePctToday - a.changePctToday);
  return { actionable, alreadyMoved, dataSource: anyLive ? "live" : "sample" };
}
