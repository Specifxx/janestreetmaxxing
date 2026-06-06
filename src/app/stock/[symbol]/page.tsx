"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { StockAnalysis } from "@/lib/types";
import { fmtCcy, fmtPct, fmtNum, fmtBig } from "@/lib/format";
import { RecPill, ScoreRing, ScoreBar, DataTag, Change, Spinner } from "@/components/ui";
import PriceChart from "@/components/PriceChart";

export default function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const [a, setA] = useState<StockAnalysis | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setA(null);
    setErr(null);
    fetch(`/api/analyze?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) setErr(d.error);
        else setA(d);
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [symbol]);

  if (err)
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--color-down)]">Could not analyse {symbol}: {err}</p>
        <Link href="/" className="text-[var(--color-accent)] text-sm mt-3 inline-block">
          ← Back to screener
        </Link>
      </div>
    );
  if (!a) return <Spinner label={`Analysing ${symbol}…`} />;

  const ccy = a.snapshot.currency;
  const pt = a.priceTargets;
  const f = a.fundamentals;
  const ind = a.indicators;

  const stat = (label: string, value: string) => (
    <div className="panel-2 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="mono text-sm mt-0.5">{value}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]">
        ← Screener
      </Link>

      {/* Header */}
      <section className="panel p-6 flex flex-wrap items-center gap-6 justify-between">
        <div className="flex items-center gap-6">
          <ScoreRing score={a.compositeScore} />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{a.snapshot.symbol}</h1>
              <RecPill rec={a.recommendation} />
              <DataTag source={a.dataSource} />
            </div>
            <div className="text-[var(--color-muted)] text-sm">{a.snapshot.name}</div>
            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-3xl font-bold mono">{fmtCcy(a.snapshot.price, ccy)}</span>
              <span className="text-lg mono">
                <Change pct={a.snapshot.changePct} />
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--color-muted)]">Blended base target</div>
          <div className="text-2xl font-bold mono">{fmtCcy(pt.base, ccy)}</div>
          <div className={`text-sm mono ${(pt.upsidePct ?? 0) >= 0 ? "up" : "down"}`}>
            {fmtPct(pt.upsidePct)} vs price
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart + targets */}
        <section className="panel p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Price &amp; targets (6 months)</h2>
            <div className="flex gap-4 text-xs">
              <span className="up">● Bull {fmtCcy(pt.bull, ccy)}</span>
              <span style={{ color: "#16c784" }}>● Base {fmtCcy(pt.base, ccy)}</span>
              <span className="down">● Bear {fmtCcy(pt.bear, ccy)}</span>
            </div>
          </div>
          <PriceChart history={a.history} target={pt.base} bull={pt.bull} bear={pt.bear} currency={ccy} />
          <p className="text-xs text-[var(--color-muted)] mt-2">{pt.blendNote}</p>
        </section>

        {/* Factor scores */}
        <section className="panel p-5 space-y-4">
          <h2 className="font-semibold">Factor breakdown</h2>
          {a.components.map((c) => (
            <div key={c.label}>
              <ScoreBar score={c.score} label={`${c.label} · weight ${(c.weight * 100).toFixed(0)}%`} />
              <p className="text-xs text-[var(--color-muted)] mt-1">{c.detail}</p>
            </div>
          ))}
        </section>
      </div>

      {/* Key stats */}
      <section className="panel p-5">
        <h2 className="font-semibold mb-3">Key statistics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {stat("Market cap", fmtBig(f.marketCap))}
          {stat("Fwd P/E", fmtNum(f.forwardPE, 1))}
          {stat("PEG", fmtNum(f.pegRatio, 2))}
          {stat("Beta", fmtNum(f.beta, 2))}
          {stat("ROE", f.returnOnEquity != null ? `${(f.returnOnEquity * 100).toFixed(0)}%` : "—")}
          {stat("Div yield", f.dividendYield != null ? `${(f.dividendYield * 100).toFixed(1)}%` : "—")}
          {stat("RSI(14)", fmtNum(ind.rsi14, 0))}
          {stat("SMA50", fmtCcy(ind.sma50, ccy))}
          {stat("SMA200", fmtCcy(ind.sma200, ccy))}
          {stat("ATR%", fmtNum(ind.atrPct, 1))}
          {stat("3m return", fmtPct(ind.return3m, 0))}
          {stat("vs 52w high", fmtPct(ind.distFrom52wHigh, 0))}
        </div>
      </section>

      {/* Valuation models */}
      <section className="panel p-5">
        <h2 className="font-semibold mb-1">Valuation models</h2>
        <p className="text-xs text-[var(--color-muted)] mb-4">
          Every model shows its formula and inputs so you can audit the working.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {a.valuations.map((m) => (
            <div key={m.name} className="panel-2 p-4">
              <div className="flex justify-between items-baseline">
                <h3 className="font-medium text-sm">{m.name}</h3>
                <span className="mono font-semibold" style={{ color: m.fairValue ? "#16c784" : "#8a96ad" }}>
                  {m.fairValue ? fmtCcy(m.fairValue, ccy) : "n/a"}
                </span>
              </div>
              <code className="block text-xs mono text-[var(--color-accent)] mt-2 bg-[var(--color-bg)] rounded p-2 overflow-x-auto">
                {m.formula}
              </code>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[var(--color-muted)]">
                {Object.entries(m.inputs).map(([k, v]) => (
                  <span key={k}>
                    {k}: <span className="mono text-[var(--color-text)]">{v == null ? "—" : String(v)}</span>
                  </span>
                ))}
              </div>
              <p className="text-xs text-[var(--color-muted)] mt-2 italic">{m.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reasoning + risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="panel p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <span className="up">●</span> Why it scores well
          </h2>
          <ul className="space-y-2 text-sm">
            {a.reasoning.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[var(--color-up)]">▸</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <span className="down">●</span> Risks &amp; caveats
          </h2>
          <ul className="space-y-2 text-sm">
            {a.risks.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[var(--color-down)]">▸</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-xs text-[var(--color-muted)] text-center">
        Model-based estimate, not financial advice. Verify before trading.
      </p>
    </div>
  );
}
