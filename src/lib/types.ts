// Shared types for the analysis engine.

export type Market = "us" | "au";

export interface OHLC {
  date: string; // ISO yyyy-mm-dd
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

export interface Fundamentals {
  currency: string;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  pegRatio?: number;
  priceToBook?: number;
  trailingEps?: number;
  forwardEps?: number;
  beta?: number;
  bookValue?: number;
  sharesOutstanding?: number;
  dividendYield?: number;
  // Cash flow / balance sheet (for DCF)
  freeCashflow?: number;
  operatingCashflow?: number;
  totalCash?: number;
  totalDebt?: number;
  ebitda?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  returnOnEquity?: number;
  profitMargins?: number;
  // Analyst consensus
  targetMeanPrice?: number;
  targetHighPrice?: number;
  targetLowPrice?: number;
  recommendationMean?: number; // 1 strong buy .. 5 sell
  numberOfAnalysts?: number;
  // Moving averages reported by Yahoo
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  averageVolume?: number;
  nextEarningsDate?: string;
}

export interface Snapshot {
  symbol: string;
  name: string;
  market: Market;
  currency: string;
  price: number;
  previousClose: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  changePct: number; // since previous close
  exchange?: string;
}

export interface Indicators {
  sma20?: number;
  sma50?: number;
  sma200?: number;
  ema12?: number;
  ema26?: number;
  rsi14?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  bbUpper?: number;
  bbLower?: number;
  bbMid?: number;
  atr14?: number;
  atrPct?: number; // ATR as % of price
  hv20?: number; // annualised historical vol from 20d returns
  return1m?: number;
  return3m?: number;
  return6m?: number;
  distFrom52wHigh?: number; // negative = below high
  distFrom52wLow?: number;
}

export interface ValuationModel {
  name: string;
  fairValue: number | null;
  formula: string;
  inputs: Record<string, number | string | null>;
  note: string;
}

export interface PriceTargets {
  base: number | null; // blended fair value
  bull: number | null;
  bear: number | null;
  blendNote: string;
  upsidePct: number | null; // base vs current
}

export interface ScoreComponent {
  label: string;
  score: number; // 0..100
  weight: number; // 0..1
  detail: string;
}

export type Recommendation =
  | "Strong Buy"
  | "Buy"
  | "Accumulate"
  | "Hold"
  | "Reduce"
  | "Avoid";

export interface StockAnalysis {
  snapshot: Snapshot;
  fundamentals: Fundamentals;
  indicators: Indicators;
  history: OHLC[];
  valuations: ValuationModel[];
  priceTargets: PriceTargets;
  components: ScoreComponent[];
  compositeScore: number; // 0..100
  recommendation: Recommendation;
  reasoning: string[];
  risks: string[];
  dataSource: "live" | "sample";
}

export interface ODTECandidate {
  symbol: string;
  name: string;
  market: Market;
  price: number;
  changePctToday: number; // since previous close
  expectedMovePct: number; // 1-day, one sigma
  expectedMove2dPct: number;
  impliedVol?: number | null;
  histVol: number;
  probUp: number; // 0..1 modelled probability next session closes higher
  upScore: number; // 0..100 composite short-term bullish score
  headroomPct: number; // remaining expected up-move after today's move
  alreadyMoved: boolean; // true => excluded / not a good entry
  signals: string[];
  bullishTargetPct: number; // suggested intraday/2d move target
}

export interface ScreenResult {
  symbol: string;
  name: string;
  market: Market;
  price: number;
  changePct: number;
  compositeScore: number;
  recommendation: Recommendation;
  upsidePct: number | null;
  rsi14?: number;
  targetBase: number | null;
  topReason: string;
  dataSource: "live" | "sample";
}
