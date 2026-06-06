"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ScreenResult } from "@/lib/types";
import { fmtCcy, fmtPct } from "@/lib/format";
import { RecPill, Change, DataTag, Spinner } from "@/components/ui";

interface Holding {
  symbol: string;
  shares: number;
  cost: number; // average cost per share (in the symbol's native currency)
}

const KEY = "billstreet:portfolio:v1";
const ccyFor = (m: string) => (m === "au" ? "AUD" : "USD");

function load(): Holding[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export default function PortfolioPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [quotes, setQuotes] = useState<Record<string, ScreenResult>>({});
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"live" | "sample">("live");

  // form state
  const [sym, setSym] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");

  useEffect(() => setHoldings(load()), []);

  const persist = (next: Holding[]) => {
    setHoldings(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const refresh = useCallback(async (hs: Holding[]) => {
    if (!hs.length) {
      setQuotes({});
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(hs.map((h) => h.symbol).join(","))}`);
      const data = await res.json();
      const map: Record<string, ScreenResult> = {};
      (data.results ?? []).forEach((r: ScreenResult) => (map[r.symbol] = r));
      setQuotes(map);
      const rs: ScreenResult[] = data.results ?? [];
      setSource(rs.some((r) => r.dataSource === "live") ? "live" : "sample");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(holdings);
  }, [holdings, refresh]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const s = sym.trim().toUpperCase();
    if (!s) return;
    const next = [
      ...holdings.filter((h) => h.symbol !== s),
      { symbol: s, shares: parseFloat(shares) || 0, cost: parseFloat(cost) || 0 },
    ];
    persist(next);
    setSym("");
    setShares("");
    setCost("");
  };

  const remove = (s: string) => persist(holdings.filter((h) => h.symbol !== s));

  // Totals grouped by currency (don't fabricate an FX rate).
  const totals = useMemo(() => {
    const byCcy: Record<string, { cost: number; value: number; day: number }> = {};
    for (const h of holdings) {
      const q = quotes[h.symbol];
      if (!q || h.shares <= 0) continue;
      const ccy = ccyFor(q.market);
      const value = q.price * h.shares;
      const costBasis = h.cost * h.shares;
      const dayChange = value * (q.changePct / 100);
      byCcy[ccy] ??= { cost: 0, value: 0, day: 0 };
      byCcy[ccy].cost += costBasis;
      byCcy[ccy].value += value;
      byCcy[ccy].day += dayChange;
    }
    return byCcy;
  }, [holdings, quotes]);

  return (
    <div className="space-y-6">
      <section className="panel p-6 sm:p-8">
        <div className="text-xs font-medium tracking-widest text-[var(--bs-gold)] uppercase mb-2">
          Bill Street · Book
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portfolio &amp; Watchlist</h1>
            <p className="text-[var(--color-muted)] mt-2 max-w-2xl">
              Track positions with live P&amp;L and Bill Street&apos;s current call on each name. Leave
              shares at 0 to use a row as a pure watchlist. Stored privately in your browser.
            </p>
          </div>
          <DataTag source={source} />
        </div>

        {/* Totals */}
        {Object.keys(totals).length > 0 && (
          <div className="grid sm:grid-cols-3 gap-3 mt-5">
            {Object.entries(totals).map(([ccy, t]) => {
              const pnl = t.value - t.cost;
              const pnlPct = t.cost > 0 ? (pnl / t.cost) * 100 : 0;
              return (
                <div key={ccy} className="bs-card p-4">
                  <div className="text-xs text-[var(--color-muted)] uppercase tracking-wide">{ccy} book value</div>
                  <div className="text-2xl font-bold mono mt-1">{fmtCcy(t.value, ccy)}</div>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className={pnl >= 0 ? "up" : "down"}>
                      {pnl >= 0 ? "+" : ""}
                      {fmtCcy(pnl, ccy)} ({fmtPct(pnlPct)})
                    </span>
                    <span className={`mono ${t.day >= 0 ? "up" : "down"}`}>
                      today {t.day >= 0 ? "+" : ""}
                      {fmtCcy(t.day, ccy)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add form */}
      <section className="panel p-5">
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Symbol</label>
            <input value={sym} onChange={(e) => setSym(e.target.value)} placeholder="AAPL / BHP.AX"
              className="panel-2 px-3 py-2 rounded-lg text-sm w-40 outline-none focus:border-[var(--color-accent)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Shares (0 = watch)</label>
            <input value={shares} onChange={(e) => setShares(e.target.value)} type="number" step="any" placeholder="0"
              className="panel-2 px-3 py-2 rounded-lg text-sm w-32 outline-none focus:border-[var(--color-accent)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-muted)] mb-1">Avg cost</label>
            <input value={cost} onChange={(e) => setCost(e.target.value)} type="number" step="any" placeholder="0.00"
              className="panel-2 px-3 py-2 rounded-lg text-sm w-32 outline-none focus:border-[var(--color-accent)]" />
          </div>
          <button className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-semibold">
            Add / Update
          </button>
        </form>
      </section>

      {/* Holdings table */}
      <section className="panel overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex justify-between items-center">
          <h2 className="font-semibold">Positions</h2>
          {loading && <span className="text-xs text-[var(--color-muted)]">refreshing…</span>}
        </div>
        {holdings.length === 0 ? (
          <div className="p-10 text-center text-[var(--color-muted)] text-sm">
            No positions yet. Add a symbol above, or browse the{" "}
            <a href="/terminal" className="text-[var(--color-accent)]">terminal</a> for ideas.
          </div>
        ) : !Object.keys(quotes).length && loading ? (
          <Spinner label="Pricing your book…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[var(--color-muted)] text-xs uppercase tracking-wide">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left font-medium px-5 py-3">Symbol</th>
                  <th className="text-right font-medium px-3 py-3">Shares</th>
                  <th className="text-right font-medium px-3 py-3">Avg cost</th>
                  <th className="text-right font-medium px-3 py-3">Last</th>
                  <th className="text-right font-medium px-3 py-3">Day</th>
                  <th className="text-right font-medium px-3 py-3">Value</th>
                  <th className="text-right font-medium px-3 py-3">P&amp;L</th>
                  <th className="text-center font-medium px-3 py-3">BS call</th>
                  <th className="text-right font-medium px-3 py-3">Target</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const q = quotes[h.symbol];
                  const ccy = q ? ccyFor(q.market) : "USD";
                  const value = q ? q.price * h.shares : 0;
                  const pnl = q ? (q.price - h.cost) * h.shares : 0;
                  const pnlPct = h.cost > 0 ? ((q?.price ?? 0) - h.cost) / h.cost * 100 : 0;
                  return (
                    <tr key={h.symbol} className="border-b border-[var(--color-border)]/60 hover:bg-[var(--color-panel-2)]">
                      <td className="px-5 py-3 cursor-pointer" onClick={() => router.push(`/stock/${encodeURIComponent(h.symbol)}`)}>
                        <div className="font-semibold">{h.symbol}</div>
                        <div className="text-xs text-[var(--color-muted)] truncate max-w-[140px]">{q?.name ?? "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-right mono">{h.shares || "—"}</td>
                      <td className="px-3 py-3 text-right mono">{h.cost ? fmtCcy(h.cost, ccy) : "—"}</td>
                      <td className="px-3 py-3 text-right mono">{q ? fmtCcy(q.price, ccy) : "—"}</td>
                      <td className="px-3 py-3 text-right mono">{q ? <Change pct={q.changePct} /> : "—"}</td>
                      <td className="px-3 py-3 text-right mono">{h.shares > 0 && q ? fmtCcy(value, ccy) : "—"}</td>
                      <td className={`px-3 py-3 text-right mono ${pnl >= 0 ? "up" : "down"}`}>
                        {h.shares > 0 && h.cost > 0 && q ? `${pnl >= 0 ? "+" : ""}${fmtCcy(pnl, ccy)} (${fmtPct(pnlPct)})` : "—"}
                      </td>
                      <td className="px-3 py-3 text-center">{q ? <RecPill rec={q.recommendation} /> : "—"}</td>
                      <td className="px-3 py-3 text-right mono">
                        {q ? fmtCcy(q.targetBase, ccy) : "—"}
                        {q?.upsidePct != null && (
                          <div className={`text-xs ${q.upsidePct >= 0 ? "up" : "down"}`}>{fmtPct(q.upsidePct)}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => remove(h.symbol)} className="text-[var(--color-muted)] hover:text-[var(--color-down)] text-xs">
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PositionSizer />

      <p className="text-xs text-[var(--color-muted)] text-center">
        Model calls are estimates, not advice. P&amp;L is indicative and excludes fees, FX and slippage.
      </p>
    </div>
  );
}

// ---- Risk-based position sizer --------------------------------------------
function PositionSizer() {
  const [account, setAccount] = useState("1000");
  const [riskPct, setRiskPct] = useState("2");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");

  const a = parseFloat(account) || 0;
  const rp = parseFloat(riskPct) || 0;
  const e = parseFloat(entry) || 0;
  const s = parseFloat(stop) || 0;
  const riskDollars = a * (rp / 100);
  const perShareRisk = e > 0 && s > 0 ? Math.abs(e - s) : 0;
  const shares = perShareRisk > 0 ? Math.floor(riskDollars / perShareRisk) : 0;
  const positionValue = shares * e;
  const pctOfAccount = a > 0 ? (positionValue / a) * 100 : 0;

  const field = (label: string, val: string, set: (v: string) => void, suffix?: string) => (
    <div>
      <label className="block text-xs text-[var(--color-muted)] mb-1">{label}</label>
      <div className="flex items-center panel-2 rounded-lg px-3">
        <input value={val} onChange={(e) => set(e.target.value)} type="number" step="any"
          className="bg-transparent py-2 text-sm w-full outline-none" />
        {suffix && <span className="text-xs text-[var(--color-muted)]">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <section className="panel p-6">
      <div className="text-xs font-medium tracking-widest text-[var(--bs-gold)] uppercase mb-2">Risk desk</div>
      <h2 className="text-xl font-semibold">Position sizer</h2>
      <p className="text-sm text-[var(--color-muted)] mt-1 mb-4">
        The first rule at Bill Street: never risk more than a fixed slice of the book on one idea.
        Size from your stop, not your hopes. <span className="mono">shares = (account × risk%) / |entry − stop|</span>
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {field("Account size", account, setAccount, "$")}
        {field("Risk / trade", riskPct, setRiskPct, "%")}
        {field("Entry price", entry, setEntry, "$")}
        {field("Stop price", stop, setStop, "$")}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <div className="bs-card p-4">
          <div className="text-xs text-[var(--color-muted)]">Risk budget</div>
          <div className="text-xl font-bold mono">${riskDollars.toFixed(2)}</div>
        </div>
        <div className="bs-card p-4">
          <div className="text-xs text-[var(--color-muted)]">Suggested shares</div>
          <div className="text-xl font-bold mono bs-gradient-text">{shares.toLocaleString()}</div>
        </div>
        <div className="bs-card p-4">
          <div className="text-xs text-[var(--color-muted)]">Position value</div>
          <div className="text-xl font-bold mono">${positionValue.toFixed(2)}</div>
        </div>
        <div className="bs-card p-4">
          <div className="text-xs text-[var(--color-muted)]">% of account</div>
          <div className={`text-xl font-bold mono ${pctOfAccount > 100 ? "down" : ""}`}>{pctOfAccount.toFixed(1)}%</div>
        </div>
      </div>
      {pctOfAccount > 100 && (
        <p className="text-xs text-[var(--color-warn)] mt-3">
          ⚠ This position needs more capital than your account — it implies leverage. Widen your stop or cut risk %.
        </p>
      )}
    </section>
  );
}
