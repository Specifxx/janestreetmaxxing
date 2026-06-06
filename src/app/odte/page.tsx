"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ODTECandidate } from "@/lib/types";
import { fmtCcy } from "@/lib/format";
import { DataTag, Change, Spinner, ScoreBar } from "@/components/ui";

type MarketSel = "all" | "us" | "au";

function ProbPill({ p }: { p: number }) {
  const pct = p * 100;
  const c = pct >= 60 ? "#16c784" : pct >= 50 ? "#5fd6a5" : pct >= 45 ? "#f0b429" : "#ea3943";
  return (
    <span className="mono font-semibold" style={{ color: c }}>
      {pct.toFixed(0)}%
    </span>
  );
}

export default function ODTEPage() {
  const router = useRouter();
  const [market, setMarket] = useState<MarketSel>("us");
  const [actionable, setActionable] = useState<ODTECandidate[]>([]);
  const [moved, setMoved] = useState<ODTECandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "sample">("live");
  const [showMoved, setShowMoved] = useState(false);

  const load = useCallback(async (m: MarketSel) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/odte?market=${m}`);
      const data = await res.json();
      setActionable(data.actionable ?? []);
      setMoved(data.alreadyMoved ?? []);
      setSource(data.dataSource ?? "sample");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(market);
  }, [market, load]);

  const ccyFor = (mk: string) => (mk === "au" ? "AUD" : "USD");

  return (
    <div className="space-y-6">
      <section className="panel p-6 sm:p-8">
        <div className="text-xs font-medium tracking-widest text-[var(--bs-gold)] uppercase mb-2">
          Bill Street · ODTE Desk
        </div>
        <h1 className="text-3xl font-bold tracking-tight">1–2 Day Upside Radar</h1>
        <p className="text-[var(--color-muted)] mt-2 max-w-3xl">
          Ranks names by a transparent <span className="text-[var(--color-text)]">probability-of-up</span> model
          (trend, MACD, RSI zone, prior-day close strength) against their{" "}
          <span className="text-[var(--color-text)]">expected daily move</span>{" "}
          <code className="mono text-[var(--color-accent)]">σ₁d = IV / √252</code>. Names that have{" "}
          <span className="text-[var(--color-warn)]">already run past their expected up-move</span> overnight or
          intraday are filtered out — the asymmetric entry is gone.
        </p>
        <div className="flex items-center gap-2 mt-5">
          {(["us", "au", "all"] as MarketSel[]).map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                market === m
                  ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                  : "panel-2 border-[var(--color-border)] text-[var(--color-muted)]"
              }`}
            >
              {m === "all" ? "All" : m.toUpperCase()}
            </button>
          ))}
          <span className="ml-2">
            <DataTag source={source} />
          </span>
        </div>
      </section>

      {loading ? (
        <Spinner label="Modelling short-term moves…" />
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {actionable.slice(0, 12).map((c) => (
              <button
                key={c.symbol}
                onClick={() => router.push(`/stock/${encodeURIComponent(c.symbol)}`)}
                className="panel p-5 text-left hover:border-[var(--color-accent)] transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{c.symbol}</div>
                    <div className="text-xs text-[var(--color-muted)] truncate max-w-[150px]">{c.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[var(--color-muted)]">P(up next session)</div>
                    <ProbPill p={c.probUp} />
                  </div>
                </div>

                <div className="mt-3">
                  <ScoreBar score={c.upScore} label="Short-term bull score" />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                  <div>
                    <div className="text-[var(--color-muted)]">Price</div>
                    <div className="mono">{fmtCcy(c.price, ccyFor(c.market))}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-muted)]">Today</div>
                    <div className="mono">
                      <Change pct={c.changePctToday} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--color-muted)]">Exp. move 1d</div>
                    <div className="mono">±{c.expectedMovePct.toFixed(1)}%</div>
                  </div>
                </div>

                <div className="mt-3 flex justify-between text-xs panel-2 px-3 py-2">
                  <span className="text-[var(--color-muted)]">
                    Target <span className="text-[var(--color-up)] mono">+{c.bullishTargetPct.toFixed(1)}%</span>
                  </span>
                  <span className="text-[var(--color-muted)]">
                    Headroom left{" "}
                    <span className={c.headroomPct >= 0 ? "up mono" : "down mono"}>
                      {c.headroomPct >= 0 ? "+" : ""}
                      {c.headroomPct.toFixed(1)}%
                    </span>
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {c.signals.slice(0, 3).map((s, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded panel-2 text-[var(--color-muted)]">
                      {s}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </section>

          {actionable.length === 0 && (
            <div className="panel p-8 text-center text-[var(--color-muted)]">
              No names with remaining upside edge right now — everything has either already moved or the model is
              bearish. Check back next session.
            </div>
          )}

          {/* Excluded / already moved */}
          {moved.length > 0 && (
            <section className="panel p-5">
              <button
                onClick={() => setShowMoved((s) => !s)}
                className="flex items-center gap-2 text-sm font-medium text-[var(--color-warn)]"
              >
                {showMoved ? "▾" : "▸"} Excluded — already moved past target ({moved.length})
              </button>
              {showMoved && (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead className="text-[var(--color-muted)] text-xs uppercase">
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="text-left px-3 py-2 font-medium">Symbol</th>
                        <th className="text-right px-3 py-2 font-medium">Today</th>
                        <th className="text-right px-3 py-2 font-medium">Exp. 1d move</th>
                        <th className="text-right px-3 py-2 font-medium">Target</th>
                        <th className="text-left px-3 py-2 font-medium">Why excluded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moved.map((c) => (
                        <tr key={c.symbol} className="border-b border-[var(--color-border)]/50">
                          <td className="px-3 py-2 font-medium">{c.symbol}</td>
                          <td className="px-3 py-2 text-right mono">
                            <Change pct={c.changePctToday} />
                          </td>
                          <td className="px-3 py-2 text-right mono">±{c.expectedMovePct.toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right mono up">+{c.bullishTargetPct.toFixed(1)}%</td>
                          <td className="px-3 py-2 text-[var(--color-muted)] text-xs">{c.signals[0]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <p className="text-xs text-[var(--color-muted)] text-center">
        Short-horizon trading is high-risk. P(up) is a model estimate, not a promise. Position size accordingly.
      </p>
    </div>
  );
}
