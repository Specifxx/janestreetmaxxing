/*
 * Real-data, look-ahead-free backtest of the ORB strategy's FOUNDATION:
 * "Factor 1 — overnight macro alignment predicts the ASX200's next-day
 *  direction ~58% of the time."
 *
 * IMPORTANT SCOPE: this tests ONLY the daily overnight-macro gate. The full
 * 5-factor system also needs the 30-min ORB break, a 1.4x volume surge and a
 * 5-min RSI band — all INTRADAY signals that require years of 5-minute ASX200
 * data, which is not freely available. So this cannot verify the headline 83%.
 * It can only check whether the *base layer* the whole stack sits on is real.
 *
 * Method (no look-ahead):
 *  - Outcome: did ^AXJO (ASX200) close UP on ASX trading day d?
 *  - Predictors, all from the most recent session that completed BEFORE the ASX
 *    open on day d (i.e. the overnight US/FX tape):
 *      * Wall St  = ^GSPC daily return   (also stands in for SPI futures)
 *      * AUD/USD  = AUDUSD=X daily return
 *      * Iron ore = BHP (NYSE ADR) daily return  (proxy)
 *  - Gate: count legs clearing their threshold in the same direction; if >= the
 *    required number, "trade" that direction. A correct call = ASX closed that
 *    way. Compared against the base rate (ASX unconditional up-rate).
 *
 * Usage:  npx tsx scripts/orb-macro-backtest.ts
 *   (needs outbound network to Yahoo Finance; run it where that is reachable.)
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface Bar {
  date: string;
  close: number;
}

async function fetchDaily(symbol: string, range = "10y"): Promise<Bar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1d&range=${range}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} fetching ${symbol}`);
  const data: any = await res.json();
  const r = data?.chart?.result?.[0];
  if (!r) throw new Error(`no chart for ${symbol}`);
  const ts: number[] = r.timestamp ?? [];
  const closes: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null) continue;
    bars.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: c });
  }
  return bars;
}

// Latest completed daily return for `bars` strictly BEFORE cutoff date.
function returnBefore(bars: Bar[], cutoff: string): number | null {
  let idx = -1;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].date < cutoff) idx = i;
    else break;
  }
  if (idx < 1) return null;
  return (bars[idx].close - bars[idx - 1].close) / bars[idx - 1].close;
}

const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);
const pct = (x: number) => (x * 100).toFixed(2) + "%";

async function main() {
  console.log("\nFetching daily history from Yahoo (^AXJO, ^GSPC, AUDUSD=X, BHP)…");
  let axjo: Bar[], gspc: Bar[], aud: Bar[], bhp: Bar[];
  try {
    [axjo, gspc, aud, bhp] = await Promise.all([
      fetchDaily("^AXJO"),
      fetchDaily("^GSPC"),
      fetchDaily("AUDUSD=X"),
      fetchDaily("BHP"),
    ]);
  } catch (e) {
    console.error(
      `\n✗ Could not fetch market data: ${e instanceof Error ? e.message : e}\n` +
        `  This sandbox may block outbound network. Run this on a normal connection.\n`,
    );
    process.exit(1);
    return;
  }

  // thresholds per leg (same spirit as the live checklist)
  const TH = { gspc: 0.005, aud: 0.003, bhp: 0.008 };
  // require >= this many of the 3 quantifiable legs aligned (proxy for the 4/5
  // rule, since AFR tone + the SPI leg can't be reconstructed historically)
  const REQ = [2, 3];

  let totalDays = 0;
  let upDays = 0;
  const buckets = new Map(REQ.map((r) => [r, { calls: 0, hits: 0 }]));

  for (let i = 1; i < axjo.length; i++) {
    const d = axjo[i].date;
    const asxRet = (axjo[i].close - axjo[i - 1].close) / axjo[i - 1].close;
    const up = asxRet > 0;
    totalDays++;
    if (up) upDays++;

    const legs = [
      { r: returnBefore(gspc, d), th: TH.gspc },
      { r: returnBefore(aud, d), th: TH.aud },
      { r: returnBefore(bhp, d), th: TH.bhp },
    ];
    if (legs.some((l) => l.r === null)) continue;

    let vote = 0;
    const cleared = legs.filter((l) => Math.abs(l.r!) >= l.th);
    cleared.forEach((l) => (vote += sign(l.r!)));
    const dir = sign(vote);
    if (dir === 0) continue;
    const aligned = cleared.filter((l) => sign(l.r!) === dir).length;

    for (const req of REQ) {
      if (aligned >= req) {
        const b = buckets.get(req)!;
        b.calls++;
        if (sign(asxRet) === dir) b.hits++;
      }
    }
  }

  const base = upDays / totalDays;
  console.log("\n============ ASX200 OVERNIGHT-MACRO GATE — REAL-DATA BACKTEST ============");
  console.log(`ASX200 (^AXJO) sessions tested: ${totalDays.toLocaleString()}`);
  console.log(`Base rate (ASX closed UP, unconditional): ${pct(base)}`);
  console.log(`\nGate = N of 3 macro legs (Wall St, AUD/USD, iron-ore proxy) aligned, no look-ahead.`);
  console.log("legs req | trades taken | directional hit-rate | edge vs base rate");
  console.log("---------|--------------|----------------------|------------------");
  for (const req of REQ) {
    const b = buckets.get(req)!;
    if (!b.calls) continue;
    const hit = b.hits / b.calls;
    // edge vs base: compare to "always bet up" only fairly when dir can be down,
    // so we show hit-rate vs max(base, 1-base) as the naive directional baseline.
    const naive = Math.max(base, 1 - base);
    console.log(
      `  >=${req}    |   ${String(b.calls).padStart(8)}   |       ${pct(hit).padStart(7)}        |   ${(
        (hit - naive) *
        100
      ).toFixed(2)}pp`,
    );
  }
  console.log("\nReminder: a positive edge HERE only validates the ~58% base layer.");
  console.log("It does NOT confirm the 83% — that needs the intraday ORB/volume/RSI");
  console.log("filters, which require 5-min data this free test cannot reach.\n");
  console.log("=========================================================================\n");
}

main();

export {};
