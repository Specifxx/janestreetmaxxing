"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui";

type Stats = {
  name: string; trades: number; wins: number; winRatePct: number;
  avgReturnPct: number; expectancyPct: number; totalReturnPct: number; maxDrawdownPct: number;
};
type Result = { ok: boolean; orb?: Stats; heikinashi?: Stats; bars?: number; days?: number; params?: any; error?: string };

function Card({ s, winner }: { s: Stats; winner: boolean }) {
  const good = s.totalReturnPct >= 0;
  return (
    <div className="panel p-6" style={winner ? { borderColor: "var(--color-up)", boxShadow: "0 0 0 1px var(--color-up)" } : {}}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{s.name}</h3>
        {winner && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-up)]/15 text-[var(--color-up)] border border-[var(--color-up)]/30">WINNER</span>}
      </div>
      <div className={`text-3xl font-bold mono mt-3 ${good ? "up" : "down"}`}>
        {good ? "+" : ""}{s.totalReturnPct.toFixed(2)}%
      </div>
      <div className="text-xs text-[var(--color-muted)]">compounded over the test (underlying, no leverage)</div>
      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <Stat k="Trades" v={String(s.trades)} />
        <Stat k="Win rate" v={`${s.winRatePct.toFixed(1)}%`} />
        <Stat k="Expectancy / trade" v={`${s.expectancyPct >= 0 ? "+" : ""}${s.expectancyPct.toFixed(3)}%`} />
        <Stat k="Max drawdown" v={`${s.maxDrawdownPct.toFixed(1)}%`} />
      </div>
    </div>
  );
}
function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="panel-2 p-3">
      <div className="text-[var(--color-muted)] text-xs">{k}</div>
      <div className="mono">{v}</div>
    </div>
  );
}

export default function ComparePage() {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  async function run() {
    setLoading(true); setRes(null);
    try {
      const r = await fetch("/api/orb/compare");
      setRes(await r.json());
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : "failed" });
    } finally { setLoading(false); }
  }

  const orb = res?.orb, ha = res?.heikinashi;
  const winnerName = orb && ha ? (orb.totalReturnPct >= ha.totalReturnPct ? orb.name : ha.name) : "";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <section className="panel p-6 sm:p-8">
        <div className="text-xs font-medium tracking-widest text-[var(--bs-gold)] uppercase mb-2">Bill Street · Strategy Lab</div>
        <h1 className="text-3xl font-bold tracking-tight">ORB vs Heikin Ashi — head to head</h1>
        <p className="text-[var(--color-muted)] mt-2 max-w-3xl">
          Backtests both strategies over the last ~60 days of 5-min ASX200 data with an
          <strong className="text-[var(--color-text)]"> identical paper position model</strong> (fixed bracket, no
          leverage), so it&apos;s a fair fight. Results measure <strong className="text-[var(--color-text)]">signal quality</strong>,
          not the leverage gamble.
        </p>
        <button onClick={run} disabled={loading}
          className="mt-5 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-white font-semibold disabled:opacity-40">
          {loading ? "Running backtest…" : "Run comparison"}
        </button>
      </section>

      {loading && <Spinner label="Backtesting both strategies on 60 days of 5-min data…" />}

      {res && !res.ok && <div className="panel p-6 text-[var(--color-down)]">✗ {res.error}</div>}

      {orb && ha && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <Card s={orb} winner={winnerName === orb.name} />
            <Card s={ha} winner={winnerName === ha.name} />
          </div>
          <div className="panel p-5 text-sm text-[var(--color-muted)] leading-relaxed">
            Tested on <span className="mono">{res.bars}</span> bars across <span className="mono">{res.days}</span> sessions ·
            shared exit: <span className="mono">{res.params.targetPct}%</span> target / <span className="mono">{res.params.stopPct}%</span> stop,
            {" "}{res.params.horizonBars}-bar horizon.
            <div className="mt-3 text-xs">
              ⚠ <strong className="text-[var(--color-text)]">Read this honestly:</strong> ~60 days is a <em>small</em> sample —
              this is a sanity check, not proof. ORB&apos;s macro gate is proxied by the overnight gap (real macro isn&apos;t
              available historically). Costs (spread/slippage) aren&apos;t charged. A winner here is suggestive, not a guarantee —
              confirm forward on Demo before trusting either.
            </div>
          </div>
        </>
      )}

      {!res && !loading && (
        <p className="text-sm text-[var(--color-muted)] text-center">Click <strong>Run comparison</strong> to backtest both strategies on live ASX200 data.</p>
      )}
    </div>
  );
}
