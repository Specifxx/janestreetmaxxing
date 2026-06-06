"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ScreenResult } from "@/lib/types";
import { fmtCcy, fmtPct } from "@/lib/format";
import { RecPill, ScoreBar, DataTag, Change, Spinner } from "@/components/ui";

type MarketSel = "all" | "us" | "au";

export default function TerminalPage() {
  const router = useRouter();
  const [market, setMarket] = useState<MarketSel>("all");
  const [rows, setRows] = useState<ScreenResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "sample">("live");
  const [query, setQuery] = useState("");

  const load = useCallback(async (m: MarketSel) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/screen?market=${m}&limit=80`);
      const data = await res.json();
      const results: ScreenResult[] = data.results ?? [];
      setRows(results);
      setSource(results.some((r) => r.dataSource === "live") ? "live" : "sample");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(market);
  }, [market, load]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (q) router.push(`/stock/${encodeURIComponent(q)}`);
  };

  const ccyFor = (m: string) => (m === "au" ? "AUD" : "USD");

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-xs font-medium tracking-widest text-[var(--bs-gold)] uppercase mb-2">
              Bill Street Terminal
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Opportunity Screener</h1>
            <p className="text-[var(--color-muted)] mt-2">
              Our 5-factor quant model ranks US &amp; ASX names on{" "}
              <span className="text-[var(--color-text)]">value, momentum, quality, technicals and sentiment</span>,
              then blends DCF, Graham, earnings-power and analyst models into a price target.
            </p>
          </div>
          <form onSubmit={onSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Symbol e.g. AAPL or BHP.AX"
              className="panel-2 px-3 py-2 rounded-lg text-sm w-56 outline-none focus:border-[var(--color-accent)]"
            />
            <button className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-semibold">
              Analyse
            </button>
          </form>
        </div>

        <div className="flex items-center gap-2 mt-5">
          {(["all", "us", "au"] as MarketSel[]).map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                market === m
                  ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                  : "panel-2 border-[var(--color-border)] text-[var(--color-muted)]"
              }`}
            >
              {m === "all" ? "All markets" : m.toUpperCase()}
            </button>
          ))}
          <span className="ml-2">
            <DataTag source={source} />
          </span>
        </div>
      </section>

      {/* Top picks */}
      {!loading && rows.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rows.slice(0, 3).map((r) => (
            <button
              key={r.symbol}
              onClick={() => router.push(`/stock/${encodeURIComponent(r.symbol)}`)}
              className="panel p-5 text-left hover:border-[var(--color-accent)] transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-lg">{r.symbol}</div>
                  <div className="text-xs text-[var(--color-muted)] truncate max-w-[180px]">{r.name}</div>
                </div>
                <RecPill rec={r.recommendation} />
              </div>
              <div className="mt-4">
                <ScoreBar score={r.compositeScore} label="Composite score" />
              </div>
              <div className="flex justify-between mt-4 text-sm">
                <span className="text-[var(--color-muted)]">{fmtCcy(r.price, ccyFor(r.market))}</span>
                <span className={(r.upsidePct ?? 0) >= 0 ? "up" : "down"}>
                  {fmtPct(r.upsidePct)} upside
                </span>
              </div>
            </button>
          ))}
        </section>
      )}

      {/* Table */}
      <section className="panel overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex justify-between items-center">
          <h2 className="font-semibold">Ranked opportunities</h2>
          <span className="text-xs text-[var(--color-muted)]">{rows.length} names</span>
        </div>
        {loading ? (
          <Spinner label="Screening the universe…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[var(--color-muted)] text-xs uppercase tracking-wide">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left font-medium px-5 py-3">#</th>
                  <th className="text-left font-medium px-3 py-3">Symbol</th>
                  <th className="text-right font-medium px-3 py-3">Price</th>
                  <th className="text-right font-medium px-3 py-3">Day</th>
                  <th className="text-left font-medium px-3 py-3 w-40">Score</th>
                  <th className="text-center font-medium px-3 py-3">Call</th>
                  <th className="text-right font-medium px-3 py-3">Target</th>
                  <th className="text-right font-medium px-3 py-3">Upside</th>
                  <th className="text-left font-medium px-3 py-3 hidden lg:table-cell">Top driver</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.symbol}
                    onClick={() => router.push(`/stock/${encodeURIComponent(r.symbol)}`)}
                    className="border-b border-[var(--color-border)]/60 hover:bg-[var(--color-panel-2)] cursor-pointer"
                  >
                    <td className="px-5 py-3 text-[var(--color-muted)] mono">{i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold">{r.symbol}</div>
                      <div className="text-xs text-[var(--color-muted)] truncate max-w-[160px]">{r.name}</div>
                    </td>
                    <td className="px-3 py-3 text-right mono">{fmtCcy(r.price, ccyFor(r.market))}</td>
                    <td className="px-3 py-3 text-right mono">
                      <Change pct={r.changePct} />
                    </td>
                    <td className="px-3 py-3">
                      <ScoreBar score={r.compositeScore} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <RecPill rec={r.recommendation} />
                    </td>
                    <td className="px-3 py-3 text-right mono">{fmtCcy(r.targetBase, ccyFor(r.market))}</td>
                    <td className={`px-3 py-3 text-right mono ${(r.upsidePct ?? 0) >= 0 ? "up" : "down"}`}>
                      {fmtPct(r.upsidePct)}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell text-[var(--color-muted)] text-xs max-w-[260px] truncate">
                      {r.topReason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
