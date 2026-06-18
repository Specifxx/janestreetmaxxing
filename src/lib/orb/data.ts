// Shared market-data layer for the ORB bot — used by both the web API routes
// and the CLI runner so the signal is computed identically everywhere.

import type { Bar5m, OvernightMacro } from "@/lib/orb/signal";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function yahoo(path: string): Promise<any> {
  const res = await fetch("https://query1.finance.yahoo.com" + path, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

export function sydneyISO(epochSec: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(epochSec * 1000));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

function rangeFor(interval: string): string {
  switch (interval) {
    case "1m": return "7d";
    case "1d": return "2y";
    default: return "60d"; // 2m/5m/15m/30m/60m/90m
  }
}

export async function fetchIntraday(symbol: string, interval = "5m"): Promise<Bar5m[]> {
  const data = await yahoo(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${rangeFor(interval)}`,
  );
  const r = data?.chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0] ?? {};
  const bars: Bar5m[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null) continue;
    bars.push({
      time: sydneyISO(ts[i]),
      open: q.open?.[i] ?? q.close[i],
      high: q.high?.[i] ?? q.close[i],
      low: q.low?.[i] ?? q.close[i],
      close: q.close[i],
      volume: q.volume?.[i] ?? 0,
    });
  }
  return bars;
}

export async function fetch5m(symbol: string): Promise<Bar5m[]> {
  return fetchIntraday(symbol, "5m");
}

export async function dailyPct(symbol: string): Promise<number> {
  const data = await yahoo(`/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`);
  const r = data?.chart?.result?.[0];
  const c: number[] = (r?.indicators?.quote?.[0]?.close ?? []).filter((x: number) => x != null);
  if (c.length < 2) return 0;
  return ((c[c.length - 1] - c[c.length - 2]) / c[c.length - 2]) * 100;
}

export interface LiveSession {
  today: Bar5m[];
  history: Bar5m[];
  macro: OvernightMacro;
  asxPrice: number;
}

// Pull everything needed to evaluate today's ASX200 ORB signal.
export async function assembleLiveSession(): Promise<LiveSession> {
  const all = await fetch5m("^AXJO");
  if (!all.length) throw new Error("No ASX200 intraday data returned");
  const latestDay = all[all.length - 1].time.slice(0, 10);
  const today = all.filter((b) => b.time.slice(0, 10) === latestDay);
  const history = all.filter((b) => b.time.slice(0, 10) !== latestDay);
  const [wallSt, aud, iron, nikkei] = await Promise.all([
    dailyPct("^GSPC"), dailyPct("AUDUSD=X"), dailyPct("BHP"), dailyPct("^N225"),
  ]);
  return {
    today,
    history,
    macro: { wallStPct: wallSt, audPct: aud, ironPct: iron, nikkeiPct: nikkei },
    asxPrice: today.length ? today[today.length - 1].close : all[all.length - 1].close,
  };
}
