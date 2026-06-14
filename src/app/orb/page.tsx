"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { DataTag, Spinner } from "@/components/ui";

// ---------------------------------------------------------------------------
// ASX200 Pre-Bell ORB Desk
// A guided, transparent implementation of the 5-factor "AFR before the bell"
// opening-range-breakout checklist. Overnight macro legs (Factor 1 + the
// Nikkei in Factor 3) are auto-pulled live; the intraday legs that need you
// watching the 10:00–10:30 chart are guided manual inputs.
// ---------------------------------------------------------------------------

type LegKey = "spi" | "wallst" | "iron" | "aud" | "nikkei";
type Leg = { key: LegKey; label: string; changePct: number };
type Dir = 1 | -1 | 0;

// Magnitude thresholds straight from the signal checklist.
const THRESH: Record<Exclude<LegKey, "nikkei">, number> = {
  spi: 0.6,
  wallst: 0.5,
  iron: 0.8,
  aud: 0.3,
};

const sign = (x: number): Dir => (x > 0 ? 1 : x < 0 ? -1 : 0);
const dirWord = (d: Dir) => (d === 1 ? "LONG" : d === -1 ? "SHORT" : "—");

function Arrow({ d }: { d: Dir }) {
  if (d === 0) return <span className="text-[var(--color-muted)]">flat</span>;
  return <span className={d === 1 ? "up" : "down"}>{d === 1 ? "▲ up" : "▼ down"}</span>;
}

function Check({ ok }: { ok: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
      style={{
        background: ok ? "var(--color-up)" : "var(--color-panel-2)",
        color: ok ? "#06281b" : "var(--color-muted)",
        border: ok ? "none" : "1px solid var(--color-border)",
      }}
    >
      {ok ? "✓" : "·"}
    </span>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: { v: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition ${
            value === o.v
              ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
              : "panel-2 border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ORBPage() {
  const [legs, setLegs] = useState<Leg[]>([]);
  const [source, setSource] = useState<"live" | "sample">("sample");
  const [asOf, setAsOf] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // ---- Manual / guided inputs ----
  const [afr, setAfr] = useState<"bull" | "bear" | "mixed" | "">("");
  const [orb, setOrb] = useState<"none" | "long" | "short">("none");
  const [volOk, setVolOk] = useState<"yes" | "no" | "">("");
  const [rsi, setRsi] = useState<string>("");

  // ---- Position & risk plan (defaults from your compounding spec) ----
  const [equity, setEquity] = useState("100");
  const [leverage, setLeverage] = useState("20");
  const [stopMove, setStopMove] = useState("1.0");
  const [baseTP, setBaseTP] = useState("0.735");
  const [runnerTP, setRunnerTP] = useState("3.0");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orb");
      const data = await res.json();
      setLegs(data.legs ?? []);
      setSource(data.dataSource ?? "sample");
      setAsOf(data.asOf ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const get = (k: LegKey) => legs.find((l) => l.key === k)?.changePct ?? 0;

  // ---- Factor 1: overnight macro gate (≥4/5 aligned in ONE direction) ----
  const macro = useMemo(() => {
    const auto = (["spi", "wallst", "iron", "aud"] as const).map((k) => {
      const chg = get(k);
      return {
        key: k,
        label: legs.find((l) => l.key === k)?.label ?? k,
        chg,
        thr: THRESH[k],
        passMag: Math.abs(chg) >= THRESH[k],
        dir: sign(chg),
      };
    });
    const afrDir: Dir = afr === "bull" ? 1 : afr === "bear" ? -1 : 0;
    const afrPass = afr === "bull" || afr === "bear";

    // Dominant direction = net vote of the legs that cleared their threshold.
    let vote = 0;
    auto.forEach((a) => {
      if (a.passMag) vote += a.dir;
    });
    vote += afrDir;
    const direction = sign(vote);

    // Aligned = cleared threshold AND points the dominant way.
    const aligned =
      auto.filter((a) => a.passMag && a.dir === direction).length +
      (afrPass && afrDir === direction ? 1 : 0);

    return { auto, afrDir, afrPass, direction, aligned, pass: direction !== 0 && aligned >= 4 };
  }, [legs, afr]); // eslint-disable-line react-hooks/exhaustive-deps

  const dir = macro.direction;

  // ---- The five conditional factors ----
  const nikkeiDir = sign(get("nikkei"));
  const rsiNum = parseFloat(rsi);
  const rsiBand = dir === 1 ? [40, 65] : dir === -1 ? [35, 60] : [40, 65];
  const f1 = macro.pass;
  const f2 = orb !== "none" && ((orb === "long" && dir === 1) || (orb === "short" && dir === -1));
  const f3 = dir !== 0 && nikkeiDir === dir;
  const f4 = volOk === "yes";
  const f5 = !isNaN(rsiNum) && rsiNum >= rsiBand[0] && rsiNum <= rsiBand[1];

  const factors = [
    { n: 1, label: "Macro gate ≥4/5", p: 58, ok: f1 },
    { n: 2, label: "ORB break confirms", p: 68, ok: f2 },
    { n: 3, label: "Nikkei aligned", p: 74, ok: f3 },
    { n: 4, label: "Volume ≥1.4×", p: 79, ok: f4 },
    { n: 5, label: "RSI not extreme", p: 83, ok: f5 },
  ];

  // Conditional stack: probability = deepest *consecutive* passed factor.
  let runLen = 0;
  for (const f of factors) {
    if (f.ok) runLen++;
    else break;
  }
  const currentProb = runLen === 0 ? 0 : factors[runLen - 1].p;
  const allGo = factors.every((f) => f.ok);
  const firstFail = factors.find((f) => !f.ok);

  // ---- Position / risk math ----
  const eq = Math.max(0, parseFloat(equity) || 0);
  const lev = Math.max(1, parseFloat(leverage) || 1);
  const stop = Math.max(0, parseFloat(stopMove) || 0);
  const base = Math.max(0, parseFloat(baseTP) || 0);
  const run = Math.max(0, parseFloat(runnerTP) || 0);
  const lossPct = lev * stop; // gross %
  const baseWinPct = lev * base;
  const runWinPct = lev * run;
  const lossesToHalve = lossPct > 0 ? Math.ceil(Math.log(0.5) / Math.log(1 - lossPct / 100)) : Infinity;
  const wipeAfter = (n: number) => eq * Math.pow(1 - Math.min(0.999, lossPct / 100), n);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section className="panel p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-medium tracking-widest text-[var(--bs-gold)] uppercase mb-2">
              Bill Street · ASX Day Desk
            </div>
            <h1 className="text-3xl font-bold tracking-tight">ASX200 Pre-Bell ORB Signaller</h1>
          </div>
          <div className="flex items-center gap-2">
            <DataTag source={source} />
            <button
              onClick={load}
              className="px-3 py-1.5 rounded-lg text-sm panel-2 border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              ↻ Refresh macro
            </button>
          </div>
        </div>
        <p className="text-[var(--color-muted)] mt-3 max-w-3xl leading-relaxed">
          A transparent, step-by-step implementation of the 5-factor{" "}
          <span className="text-[var(--color-text)]">opening-range-breakout</span> checklist. The
          overnight macro legs are pulled live; the intraday legs that need you watching the
          10:00–10:30 AEST chart are guided inputs. Tick the gates in order — the desk computes your
          direction, the conditional win-rate stack, and a single <strong>GO / NO-TRADE</strong>{" "}
          verdict.
        </p>
        {asOf && (
          <p className="text-[11px] text-[var(--color-muted)] mt-2">
            Macro snapshot as of {new Date(asOf).toLocaleString()} · iron ore shown via BHP/RIO ADR
            proxy.
          </p>
        )}

        {/* timeline */}
        <div className="grid sm:grid-cols-4 gap-3 mt-5">
          {[
            { t: "Pre-open", d: "Check overnight macro (auto below) + AFR tone. No 4/5 → done, no trade today." },
            { t: "10:00–10:30", d: "Mark the first 30-min range (ORB) high & low. Wait." },
            { t: "Break", d: "Only act on a 5-min close beyond the ORB in your macro direction, on ≥1.4× volume." },
            { t: "Entry", d: "Confirm Nikkei aligned + 5-min RSI in band, then size with a hard 1% stop." },
          ].map((s, i) => (
            <div key={i} className="panel-2 p-3">
              <div className="text-xs font-semibold text-[var(--bs-gold)]">{s.t}</div>
              <div className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {loading ? (
        <Spinner label="Pulling overnight macro…" />
      ) : (
        <>
          {/* VERDICT BAR */}
          <section
            className="panel p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{
              borderColor: allGo ? "var(--color-up)" : firstFail ? "var(--color-border)" : "var(--color-border)",
              boxShadow: allGo ? "0 0 0 1px var(--color-up), 0 0 30px -8px var(--color-up)" : "none",
            }}
          >
            <div>
              <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">Verdict</div>
              <div
                className="text-3xl font-bold mt-1"
                style={{ color: allGo ? "var(--color-up)" : "var(--color-down)" }}
              >
                {allGo ? `GO · ${dirWord(dir)}` : "NO TRADE"}
              </div>
              <div className="text-sm text-[var(--color-muted)] mt-1">
                {allGo
                  ? "All five gates aligned. Size with a hard stop and follow the plan."
                  : !f1
                    ? `Macro gate not met — only ${macro.aligned}/5 legs aligned${
                        dir === 0 ? " and no clear direction" : ""
                      }.`
                    : `Blocked at Factor ${firstFail?.n} — ${firstFail?.label}.`}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
                Stacked win-rate
              </div>
              <div
                className="text-4xl font-bold mono"
                style={{ color: currentProb >= 80 ? "var(--color-up)" : currentProb >= 58 ? "var(--bs-gold)" : "var(--color-muted)" }}
              >
                {currentProb}%
              </div>
              <div className="text-[11px] text-[var(--color-muted)]">
                {runLen}/5 gates passed in sequence
              </div>
            </div>
          </section>

          {/* STEP 1 — MACRO */}
          <section className="panel p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Step 1 · Overnight macro gate{" "}
                <span className="text-sm text-[var(--color-muted)] font-normal">(Factor 1 — required)</span>
              </h2>
              <div className="text-sm">
                Direction:{" "}
                <span
                  className="font-bold mono"
                  style={{ color: dir === 1 ? "var(--color-up)" : dir === -1 ? "var(--color-down)" : "var(--color-muted)" }}
                >
                  {dirWord(dir)}
                </span>{" "}
                · <span className={macro.pass ? "up" : "down"}>{macro.aligned}/5 aligned</span>
              </div>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead className="text-[var(--color-muted)] text-xs uppercase">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left px-3 py-2 font-medium">Signal</th>
                    <th className="text-right px-3 py-2 font-medium">Overnight</th>
                    <th className="text-right px-3 py-2 font-medium">Threshold</th>
                    <th className="text-center px-3 py-2 font-medium">Direction</th>
                    <th className="text-center px-3 py-2 font-medium">Aligned</th>
                  </tr>
                </thead>
                <tbody>
                  {macro.auto.map((a) => {
                    const aligned = a.passMag && a.dir === dir;
                    return (
                      <tr key={a.key} className="border-b border-[var(--color-border)]/50">
                        <td className="px-3 py-2">{a.label}</td>
                        <td className="px-3 py-2 text-right mono">
                          <span className={a.chg >= 0 ? "up" : "down"}>
                            {a.chg >= 0 ? "+" : ""}
                            {a.chg.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right mono text-[var(--color-muted)]">
                          &gt;{a.thr}%
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Arrow d={a.dir} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Check ok={aligned} />
                        </td>
                      </tr>
                    );
                  })}
                  {/* AFR tone — manual */}
                  <tr className="border-b border-[var(--color-border)]/50">
                    <td className="px-3 py-2">
                      AFR article tone
                      <div className="text-[11px] text-[var(--color-muted)]">
                        Unambiguous bull/bear only — &quot;mixed&quot; fails.
                      </div>
                    </td>
                    <td className="px-3 py-2" colSpan={2}>
                      <Toggle
                        value={afr}
                        onChange={(v) => setAfr(v as typeof afr)}
                        options={[
                          { v: "bull", label: "Bullish" },
                          { v: "bear", label: "Bearish" },
                          { v: "mixed", label: "Mixed" },
                        ]}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Arrow d={macro.afrDir} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Check ok={macro.afrPass && macro.afrDir === dir} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--color-muted)] mt-3">
              The gate needs <strong>≥4 of 5</strong> legs clearing their threshold in the{" "}
              <em>same</em> direction. This alone is ~58% and filters out ~40% of days. Required but
              not sufficient.
            </p>
          </section>

          {/* STEP 2 — INTRADAY */}
          <section className="panel p-6 space-y-5">
            <h2 className="text-lg font-semibold">
              Step 2 · Intraday confirmation{" "}
              <span className="text-sm text-[var(--color-muted)] font-normal">(Factors 2–5, after 10:30)</span>
            </h2>

            {/* Factor 2 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 panel-2 p-4">
              <div className="md:max-w-md">
                <div className="font-medium flex items-center gap-2">
                  <Check ok={f2} /> Factor 2 — 30-min ORB break
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Did price <strong>close a 5-min candle</strong> beyond the opening-range
                  {dir !== 0 ? ` (you need a ${dirWord(dir)} break)` : ""}? A break against your macro
                  direction is a no-trade.
                </p>
              </div>
              <Toggle
                value={orb}
                onChange={(v) => setOrb(v as typeof orb)}
                options={[
                  { v: "none", label: "No break yet" },
                  { v: "long", label: "Closed above ORB high" },
                  { v: "short", label: "Closed below ORB low" },
                ]}
              />
            </div>

            {/* Factor 3 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 panel-2 p-4">
              <div className="md:max-w-md">
                <div className="font-medium flex items-center gap-2">
                  <Check ok={f3} /> Factor 3 — Nikkei 225 alignment{" "}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                    auto
                  </span>
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Nikkei must be trending the same way at 10:30 AEST. If it fights your direction, skip.
                </p>
              </div>
              <div className="text-right mono">
                <span className={get("nikkei") >= 0 ? "up" : "down"}>
                  {get("nikkei") >= 0 ? "+" : ""}
                  {get("nikkei").toFixed(2)}%
                </span>
                <div className="text-[11px] text-[var(--color-muted)]">{dirWord(nikkeiDir)}</div>
              </div>
            </div>

            {/* Factor 4 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 panel-2 p-4">
              <div className="md:max-w-md">
                <div className="font-medium flex items-center gap-2">
                  <Check ok={f4} /> Factor 4 — Volume surge
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  At the break, the 5-min candle volume must be <strong>≥1.4×</strong> the average for
                  that time of day over the last 10 sessions.
                </p>
              </div>
              <Toggle
                value={volOk}
                onChange={(v) => setVolOk(v as typeof volOk)}
                options={[
                  { v: "yes", label: "Yes ≥1.4×" },
                  { v: "no", label: "No / low vol" },
                ]}
              />
            </div>

            {/* Factor 5 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 panel-2 p-4">
              <div className="md:max-w-md">
                <div className="font-medium flex items-center gap-2">
                  <Check ok={f5} /> Factor 5 — 5-min RSI(14) not extreme
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  At entry, the 5-min RSI(14) must be{" "}
                  <strong>
                    {rsiBand[0]}–{rsiBand[1]}
                  </strong>{" "}
                  for a {dirWord(dir)} setup. Above that and the move is already overextended.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={rsi}
                  onChange={(e) => setRsi(e.target.value)}
                  placeholder="RSI"
                  className="w-24 px-3 py-2 rounded-lg panel-2 border border-[var(--color-border)] mono text-sm focus:outline-none focus:border-[var(--color-accent)]"
                />
                <span className="text-xs text-[var(--color-muted)]">
                  band {rsiBand[0]}–{rsiBand[1]}
                </span>
              </div>
            </div>
          </section>

          {/* PROB STACK */}
          <section className="panel p-6">
            <h2 className="text-lg font-semibold mb-1">Conditional probability stack</h2>
            <p className="text-xs text-[var(--color-muted)] mb-4">
              Each gate only counts once every gate before it has passed. These hit-rates are the
              strategy&apos;s <em>claimed</em> historical numbers — treat them as an unproven prior, not
              a promise.
            </p>
            <div className="space-y-2.5">
              {factors.map((f, i) => {
                const reached = i < runLen;
                return (
                  <div key={f.n} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-sm flex items-center gap-2">
                      <Check ok={f.ok} /> {f.label}
                    </span>
                    <div className="flex-1 h-3 rounded-full bg-[var(--color-panel-2)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${f.p}%`,
                          background: reached ? "var(--color-up)" : "var(--color-border)",
                          opacity: reached ? 1 : 0.5,
                        }}
                      />
                    </div>
                    <span
                      className="w-12 text-right mono text-sm"
                      style={{ color: reached ? "var(--color-up)" : "var(--color-muted)" }}
                    >
                      {f.p}%
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* STEP 3 — POSITION & RISK */}
          <section className="panel p-6">
            <h2 className="text-lg font-semibold">
              Step 3 · Position &amp; risk plan{" "}
              <span className="text-sm text-[var(--color-muted)] font-normal">(your compounding spec)</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
              {[
                { l: "Equity ($)", v: equity, set: setEquity, step: "1" },
                { l: "Leverage (×)", v: leverage, set: setLeverage, step: "1" },
                { l: "Stop (ASX % move)", v: stopMove, set: setStopMove, step: "0.1" },
                { l: "Base TP (% move)", v: baseTP, set: setBaseTP, step: "0.005" },
                { l: "Runner TP (% move)", v: runnerTP, set: setRunnerTP, step: "0.1" },
              ].map((f) => (
                <label key={f.l} className="text-xs text-[var(--color-muted)]">
                  {f.l}
                  <input
                    type="number"
                    step={f.step}
                    value={f.v}
                    onChange={(e) => f.set(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg panel-2 border border-[var(--color-border)] mono text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </label>
              ))}
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              <div className="panel-2 p-4">
                <div className="text-xs text-[var(--color-muted)]">If stopped out (−{lossPct.toFixed(1)}%)</div>
                <div className="text-2xl font-bold mono down">
                  −${(eq * lossPct / 100).toFixed(2)}
                </div>
                <div className="text-[11px] text-[var(--color-muted)]">→ ${(eq - eq * lossPct / 100).toFixed(2)} left</div>
              </div>
              <div className="panel-2 p-4">
                <div className="text-xs text-[var(--color-muted)]">Base win (+{baseWinPct.toFixed(1)}%)</div>
                <div className="text-2xl font-bold mono up">+${(eq * baseWinPct / 100).toFixed(2)}</div>
                <div className="text-[11px] text-[var(--color-muted)]">→ ${(eq + eq * baseWinPct / 100).toFixed(2)}</div>
              </div>
              <div className="panel-2 p-4">
                <div className="text-xs text-[var(--color-muted)]">Runner win (+{runWinPct.toFixed(1)}%)</div>
                <div className="text-2xl font-bold mono up">+${(eq * runWinPct / 100).toFixed(2)}</div>
                <div className="text-[11px] text-[var(--color-muted)]">→ ${(eq + eq * runWinPct / 100).toFixed(2)}</div>
              </div>
            </div>

            {/* RUIN REALITY CHECK */}
            <div className="mt-4 rounded-xl border border-[var(--color-down)]/40 bg-[var(--color-down)]/8 p-4">
              <div className="font-semibold text-[var(--color-down)] flex items-center gap-2">
                ⚠ Reality check — {leverage}× leverage is the real risk, not the signal
              </div>
              <ul className="text-sm text-[var(--color-muted)] mt-2 space-y-1.5 leading-relaxed">
                <li>
                  • One stop-out costs <strong className="text-[var(--color-text)]">{lossPct.toFixed(1)}%</strong> of the
                  whole account. Just <strong className="text-[var(--color-text)]">{lossesToHalve}</strong> losing trades
                  in a row halves it.
                </li>
                <li>
                  • Run of losses on ${eq.toFixed(0)}: 3 → ${wipeAfter(3).toFixed(2)}, 5 → $
                  {wipeAfter(5).toFixed(2)}, 8 → ${wipeAfter(8).toFixed(2)}.
                </li>
                <li>
                  • The 83% win-rate is an <strong className="text-[var(--color-text)]">assumption from a marketing
                  slide</strong>, not a walk-forward result. At a true 65% win rate, a {leverage}× plan blows up on most
                  paths. Your own Monte Carlo showed a <strong className="text-[var(--color-text)]">~42% median
                  drawdown</strong> even when the 83% holds.
                </li>
                <li>
                  • This calculator is for sizing and education only. Start on paper / sim. Never risk money you can&apos;t
                  lose.
                </li>
              </ul>
            </div>
          </section>

          {/* INSTRUCTIONS */}
          <section className="panel p-6">
            <h2 className="text-lg font-semibold mb-3">How to use it (each trading morning)</h2>
            <ol className="text-sm text-[var(--color-muted)] space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Before the 10:00 AEST open, hit <em>Refresh macro</em> and set the AFR tone. If you don&apos;t
                get a clear direction with ≥4/5 aligned, the verdict stays NO TRADE — close the app, no trade today.
              </li>
              <li>
                If the gate passes, note your <strong>direction</strong> (LONG/SHORT). Open your ASX200 / AUS200 chart
                and mark the high and low of 10:00–10:30 (the ORB).
              </li>
              <li>
                Wait for a <strong>5-min candle to close</strong> beyond the ORB in your direction, then set Factor 2.
              </li>
              <li>
                Check the break candle&apos;s volume (Factor 4) and your 5-min RSI(14) (Factor 5). Factor 3 (Nikkei) is
                already auto-filled.
              </li>
              <li>
                Only when the verdict flips to <strong className="text-[var(--color-up)]">GO</strong> do you enter — with
                a hard stop at the 1% ASX200 level from Step 3.
              </li>
            </ol>
          </section>

          <p className="text-xs text-[var(--color-muted)] text-center max-w-3xl mx-auto leading-relaxed">
            Educational tool, not financial advice. Leveraged intraday trading can lose more than your deposit. The
            macro feed is best-effort from public data and falls back to clearly-labelled sample numbers when the
            network is restricted — never trade off SAMPLE DATA.
          </p>
        </>
      )}
    </div>
  );
}
