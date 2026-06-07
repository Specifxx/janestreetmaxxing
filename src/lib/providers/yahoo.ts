// Minimal Yahoo Finance client. Yahoo's public JSON endpoints are free but now
// require a cookie + "crumb" for the quote/quoteSummary APIs. We fetch and
// cache those once per process. The chart endpoint usually works with just a
// browser User-Agent.
//
// NOTE: these endpoints are unofficial and rate-limited. The app caches
// aggressively and fetches with bounded concurrency.

import { cached } from "@/lib/cache";
import type { Fundamentals, OHLC, Snapshot, Market } from "@/lib/types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const BASES = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

// Fast-fail timeout so a slow/blocked upstream can never hang a serverless
// function (which would otherwise burn the whole request budget on Vercel).
const FETCH_TIMEOUT_MS = 7000;
function timeoutSignal(ms = FETCH_TIMEOUT_MS): AbortSignal {
  // AbortSignal.timeout is available on Node 18+/modern runtimes.
  return AbortSignal.timeout(ms);
}

let crumbCache: { crumb: string; cookie: string } | null = null;

async function getCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (crumbCache) return crumbCache;
  // 1. Hit finance home to receive a session cookie.
  const res = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": UA },
    redirect: "manual",
    signal: timeoutSignal(),
  }).catch(() => null);
  let cookie = "";
  if (res) {
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
  }
  // 2. Exchange cookie for a crumb.
  const cr = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, ...(cookie ? { Cookie: cookie } : {}) },
    signal: timeoutSignal(),
  });
  const crumb = (await cr.text()).trim();
  crumbCache = { crumb, cookie };
  return crumbCache;
}

async function getJSON(path: string, withCrumb = false): Promise<unknown> {
  let lastErr: unknown = null;
  for (const base of BASES) {
    try {
      let url = base + path;
      const headers: Record<string, string> = { "User-Agent": UA };
      if (withCrumb) {
        const { crumb, cookie } = await getCrumb();
        if (cookie) headers.Cookie = cookie;
        url += (url.includes("?") ? "&" : "?") + "crumb=" + encodeURIComponent(crumb);
      }
      const res = await fetch(url, { headers, signal: timeoutSignal() });
      if (!res.ok) {
        lastErr = new Error(`${res.status} ${url}`);
        continue;
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("yahoo request failed");
}

function marketFor(symbol: string, exchange?: string): Market {
  if (symbol.endsWith(".AX") || exchange === "ASX") return "au";
  return "us";
}

// ---- Historical chart (OHLCV) ---------------------------------------------
export async function fetchChart(symbol: string, range = "1y"): Promise<{
  snapshot: Snapshot;
  history: OHLC[];
}> {
  return cached(`chart:${symbol}:${range}`, 5 * 60_000, async () => {
    const data = (await getJSON(
      `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}&includePrePost=false`,
    )) as any;
    const r = data?.chart?.result?.[0];
    if (!r) throw new Error(`no chart for ${symbol}`);
    const meta = r.meta;
    const ts: number[] = r.timestamp ?? [];
    const q = r.indicators?.quote?.[0] ?? {};
    const adj = r.indicators?.adjclose?.[0]?.adjclose;
    const history: OHLC[] = [];
    for (let i = 0; i < ts.length; i++) {
      const close = q.close?.[i];
      if (close == null) continue;
      history.push({
        date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
        open: q.open?.[i] ?? close,
        high: q.high?.[i] ?? close,
        low: q.low?.[i] ?? close,
        close,
        adjClose: adj?.[i] ?? close,
        volume: q.volume?.[i] ?? 0,
      });
    }
    const price = meta.regularMarketPrice ?? history[history.length - 1]?.close;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const snapshot: Snapshot = {
      symbol,
      name: meta.shortName || meta.longName || symbol,
      market: marketFor(symbol, meta.exchangeName),
      currency: meta.currency || "USD",
      price,
      previousClose: prev,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      changePct: prev ? ((price - prev) / prev) * 100 : 0,
      exchange: meta.exchangeName,
    };
    return { snapshot, history };
  });
}

// ---- Fundamentals (quoteSummary modules) ----------------------------------
export async function fetchFundamentals(symbol: string): Promise<Fundamentals> {
  return cached(`fund:${symbol}`, 30 * 60_000, async () => {
    const modules = [
      "price",
      "summaryDetail",
      "defaultKeyStatistics",
      "financialData",
      "calendarEvents",
    ].join(",");
    const data = (await getJSON(
      `/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`,
      true,
    )) as any;
    const r = data?.quoteSummary?.result?.[0] ?? {};
    const sd = r.summaryDetail ?? {};
    const ks = r.defaultKeyStatistics ?? {};
    const fd = r.financialData ?? {};
    const cal = r.calendarEvents ?? {};
    const raw = (x: any) => (x && typeof x === "object" ? x.raw : x);

    return {
      currency: sd.currency || r.price?.currency || "USD",
      marketCap: raw(sd.marketCap ?? r.price?.marketCap),
      trailingPE: raw(sd.trailingPE),
      forwardPE: raw(sd.forwardPE ?? ks.forwardPE),
      pegRatio: raw(ks.pegRatio),
      priceToBook: raw(ks.priceToBook),
      trailingEps: raw(ks.trailingEps),
      forwardEps: raw(ks.forwardEps),
      beta: raw(sd.beta ?? ks.beta),
      bookValue: raw(ks.bookValue),
      sharesOutstanding: raw(ks.sharesOutstanding),
      dividendYield: raw(sd.dividendYield),
      freeCashflow: raw(fd.freeCashflow),
      operatingCashflow: raw(fd.operatingCashflow),
      totalCash: raw(fd.totalCash),
      totalDebt: raw(fd.totalDebt),
      ebitda: raw(fd.ebitda),
      revenueGrowth: raw(fd.revenueGrowth),
      earningsGrowth: raw(fd.earningsGrowth),
      returnOnEquity: raw(fd.returnOnEquity),
      profitMargins: raw(fd.profitMargins ?? ks.profitMargins),
      targetMeanPrice: raw(fd.targetMeanPrice),
      targetHighPrice: raw(fd.targetHighPrice),
      targetLowPrice: raw(fd.targetLowPrice),
      recommendationMean: raw(fd.recommendationMean),
      numberOfAnalysts: raw(fd.numberOfAnalystOpinions),
      fiftyDayAverage: raw(sd.fiftyDayAverage),
      twoHundredDayAverage: raw(sd.twoHundredDayAverage),
      fiftyTwoWeekHigh: raw(sd.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: raw(sd.fiftyTwoWeekLow),
      averageVolume: raw(sd.averageVolume),
      nextEarningsDate: cal.earnings?.earningsDate?.[0]?.fmt,
    };
  });
}

// ---- Options: nearest-expiry ATM implied volatility (for ODTE) ------------
export async function fetchAtmIV(symbol: string): Promise<number | null> {
  return cached(`iv:${symbol}`, 10 * 60_000, async () => {
    try {
      const data = (await getJSON(
        `/v7/finance/options/${encodeURIComponent(symbol)}`,
        true,
      )) as any;
      const r = data?.optionChain?.result?.[0];
      if (!r) return null;
      const price = r.quote?.regularMarketPrice;
      const calls = r.options?.[0]?.calls ?? [];
      if (!calls.length || !price) return null;
      // ATM = strike closest to spot.
      let best = calls[0];
      for (const c of calls) {
        if (Math.abs(c.strike - price) < Math.abs(best.strike - price)) best = c;
      }
      const iv = best.impliedVolatility;
      return typeof iv === "number" && iv > 0 ? iv : null;
    } catch {
      return null;
    }
  });
}

export async function searchSymbols(
  q: string,
): Promise<{ symbol: string; name: string; exchange: string }[]> {
  const data = (await getJSON(
    `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`,
  )) as any;
  return (data?.quotes ?? [])
    .filter((x: any) => x.symbol && (x.quoteType === "EQUITY" || x.quoteType === "ETF"))
    .map((x: any) => ({
      symbol: x.symbol,
      name: x.shortname || x.longname || x.symbol,
      exchange: x.exchange,
    }));
}
