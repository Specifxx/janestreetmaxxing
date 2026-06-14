import Link from "next/link";
import StatCounter from "@/components/StatCounter";
import TickerTape from "@/components/TickerTape";

function Pipeline() {
  const steps = [
    { n: "01", t: "Ingest", d: "Live US + ASX prices, fundamentals and option-implied vol, pulled and cached every session." },
    { n: "02", t: "Model", d: "DCF, Graham, earnings-power and analyst models run side-by-side; technicals computed from scratch." },
    { n: "03", t: "Score", d: "Five orthogonal factors fused into one 0-100 conviction score, gated by upside to fair value." },
    { n: "04", t: "Target", d: "A blended base / bull / bear price target with the full formula and inputs exposed." },
    { n: "05", t: "Execute", d: "Ranked opportunities and a short-horizon ODTE desk — sized for a Stake-style account." },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-5">
      {steps.map((s) => (
        <div key={s.n} className="bs-card p-5">
          <div className="mono text-sm text-[var(--bs-gold)]">{s.n}</div>
          <div className="font-semibold mt-2">{s.t}</div>
          <div className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">{s.d}</div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="-mt-8">
      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 bs-grid pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-1 pt-16 pb-12">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="bs-fadeup">
              <div className="inline-flex items-center gap-2 bs-chip px-3 py-1.5 text-xs text-[var(--color-muted)] mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-up)] animate-pulse" />
                A quantitative trading firm · coded end-to-end by Claude
              </div>
              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
                Bill <span className="bs-gradient-text">Street</span>
              </h1>
              <p className="text-xl text-[var(--color-text)] mt-4 font-medium">
                Institutional-grade quant research. Retail-sized account.
              </p>
              <p className="text-[var(--color-muted)] mt-3 max-w-xl leading-relaxed">
                We turn the same toolkit the big desks use — discounted cash flow, factor models,
                volatility-based expected moves — into a transparent platform you can actually act on
                across US &amp; ASX. No black boxes. Every number shows its working.
              </p>
              <div className="flex flex-wrap gap-3 mt-7">
                <Link
                  href="/terminal"
                  className="px-5 py-3 rounded-xl bg-[var(--color-accent)] text-white font-semibold hover:brightness-110 transition bs-glow"
                >
                  Open the Terminal →
                </Link>
                <Link
                  href="/research"
                  className="px-5 py-3 rounded-xl bs-card font-semibold hover:border-[var(--bs-gold)] transition"
                >
                  See the research
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-xs text-[var(--color-muted)]">
                <span>✓ 5-factor opportunity model</span>
                <span>✓ Transparent price targets</span>
                <span>✓ Published backtests</span>
              </div>
            </div>

            {/* faux terminal preview */}
            <div className="bs-card p-5 bs-fadeup" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
                <span className="w-3 h-3 rounded-full bg-[var(--color-down)]" />
                <span className="w-3 h-3 rounded-full bg-[var(--color-warn)]" />
                <span className="w-3 h-3 rounded-full bg-[var(--color-up)]" />
                <span className="ml-2 text-xs text-[var(--color-muted)] mono">billstreet://terminal</span>
              </div>
              <div className="mono text-sm mt-3 space-y-2">
                <div className="text-[var(--color-muted)]">$ rank --market=all --top=3</div>
                {[
                  { s: "NVDA", sc: 82, t: "Strong Buy", up: "+18%", c: "var(--color-up)" },
                  { s: "BHP.AX", sc: 71, t: "Buy", up: "+11%", c: "var(--color-up)" },
                  { s: "META", sc: 68, t: "Buy", up: "+9%", c: "var(--color-up)" },
                ].map((r) => (
                  <div key={r.s} className="flex items-center justify-between panel-2 px-3 py-2 rounded-lg">
                    <span className="font-semibold">{r.s}</span>
                    <span className="text-[var(--color-muted)]">score {r.sc}</span>
                    <span style={{ color: r.c }}>{r.t}</span>
                    <span className="up">{r.up}</span>
                  </div>
                ))}
                <div className="text-[var(--color-muted)] text-xs pt-1">
                  ▸ blended DCF + Graham + earnings-power + analyst · 5-factor score
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <TickerTape />

      {/* STATS */}
      <section className="max-w-7xl mx-auto px-1 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCounter value={491867} label="Predictions backtested" />
          <StatCounter value={5} label="Factor conviction model" />
          <StatCounter value={4} label="Valuation models / name" />
          <StatCounter value={2} label="Markets · US + ASX" />
        </div>
      </section>

      {/* THESIS */}
      <section className="max-w-7xl mx-auto px-1 py-6">
        <h2 className="text-2xl font-bold tracking-tight mb-2">The thesis</h2>
        <p className="text-[var(--color-muted)] mb-6 max-w-2xl">
          We can&apos;t out-spend the giants on co-located servers and microwave towers. So we compete
          where edge is actually durable: process, discipline and honesty.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              t: "Edge from process, not hype",
              d: "Repeatable, formula-driven decisions beat gut feel. Every recommendation is reproducible from the same public data and published maths.",
            },
            {
              t: "Radical transparency",
              d: "We show the formula, the inputs and the backtest behind every call — including the strategies that didn't work. Trust is the product.",
            },
            {
              t: "Built for small accounts",
              d: "Tuned for US + ASX names you can trade on Stake, with position-aware, risk-first framing. No minimums, no gatekeeping.",
            },
          ].map((c) => (
            <div key={c.t} className="bs-card p-6">
              <div className="font-semibold text-lg">{c.t}</div>
              <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT THE DESK DOES */}
      <section className="max-w-7xl mx-auto px-1 py-10">
        <h2 className="text-2xl font-bold tracking-tight mb-6">The trading desk</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Link href="/terminal" className="bs-card p-6 hover:border-[var(--color-accent)] transition group">
            <div className="flex justify-between items-start">
              <div className="font-semibold text-lg">Opportunity Terminal</div>
              <span className="text-[var(--color-accent)] group-hover:translate-x-1 transition">→</span>
            </div>
            <p className="text-sm text-[var(--color-muted)] mt-2">
              Live-ranked US &amp; ASX opportunities with conviction score, recommendation and a blended
              price target. Search any symbol for a full report.
            </p>
          </Link>
          <Link href="/odte" className="bs-card p-6 hover:border-[var(--color-accent)] transition group">
            <div className="flex justify-between items-start">
              <div className="font-semibold text-lg">ODTE Desk</div>
              <span className="text-[var(--color-accent)] group-hover:translate-x-1 transition">→</span>
            </div>
            <p className="text-sm text-[var(--color-muted)] mt-2">
              Short-horizon (1–2 day) upside radar using option-implied expected moves — and it filters
              out names that have already made their move.
            </p>
          </Link>
          <Link href="/orb" className="bs-card p-6 hover:border-[var(--color-accent)] transition group">
            <div className="flex justify-between items-start">
              <div className="font-semibold text-lg">ASX200 ORB Signaller</div>
              <span className="text-[var(--color-accent)] group-hover:translate-x-1 transition">→</span>
            </div>
            <p className="text-sm text-[var(--color-muted)] mt-2">
              A guided 5-factor opening-range-breakout checklist for ASX day trades — live overnight
              macro gate, intraday confirmation, a conditional win-rate stack and a hard GO / NO-TRADE
              verdict with leverage-aware risk sizing.
            </p>
          </Link>
          <Link href="/stock/NVDA" className="bs-card p-6 hover:border-[var(--color-accent)] transition group">
            <div className="flex justify-between items-start">
              <div className="font-semibold text-lg">Single-name research</div>
              <span className="text-[var(--color-accent)] group-hover:translate-x-1 transition">→</span>
            </div>
            <p className="text-sm text-[var(--color-muted)] mt-2">
              DCF, Graham, earnings-power and analyst valuations side-by-side, with charts, factor
              breakdown, bull/bear targets, reasoning and risks.
            </p>
          </Link>
          <Link href="/research" className="bs-card p-6 hover:border-[var(--color-accent)] transition group">
            <div className="flex justify-between items-start">
              <div className="font-semibold text-lg">Research &amp; backtests</div>
              <span className="text-[var(--color-accent)] group-hover:translate-x-1 transition">→</span>
            </div>
            <p className="text-sm text-[var(--color-muted)] mt-2">
              The full methodology and our walk-forward backtests on ~500k real predictions — wins,
              losses and what we&apos;re refining next.
            </p>
          </Link>
        </div>
      </section>

      {/* PIPELINE */}
      <section className="max-w-7xl mx-auto px-1 py-10">
        <h2 className="text-2xl font-bold tracking-tight mb-6">How a trade gets made</h2>
        <Pipeline />
      </section>

      {/* TRANSPARENCY */}
      <section className="max-w-7xl mx-auto px-1 py-10">
        <div className="bs-card p-8 bs-glow">
          <div className="grid md:grid-cols-3 gap-6 items-center">
            <div className="md:col-span-2">
              <div className="text-xs font-medium tracking-widest text-[var(--bs-gold)] uppercase mb-2">
                Why you can trust us
              </div>
              <h3 className="text-2xl font-bold">We publish the backtests — even the ugly ones.</h3>
              <p className="text-[var(--color-muted)] mt-3 leading-relaxed">
                Most &quot;guru&quot; platforms only show winners. We ran our short-horizon model on
                491,867 real, look-ahead-free predictions and reported the result honestly: the naïve
                momentum signal didn&apos;t beat a coin flip. That finding is what points us at the
                strategies that might. Open methodology is the whole pitch.
              </p>
              <Link href="/research" className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-white font-semibold hover:brightness-110 transition">
                Read the full research →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="panel-2 p-4 text-center">
                <div className="text-3xl font-bold mono">~51%</div>
                <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide mt-1">Naïve model hit-rate (honest)</div>
              </div>
              <div className="panel-2 p-4 text-center">
                <div className="text-3xl font-bold mono bs-gradient-text">100%</div>
                <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide mt-1">Formulas disclosed</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-7xl mx-auto px-1 py-14 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Trade the <span className="bs-gradient-text">numbers</span>, not the noise.
        </h2>
        <p className="text-[var(--color-muted)] mt-3 max-w-xl mx-auto">
          Open the terminal and see today&apos;s ranked opportunities across US &amp; ASX.
        </p>
        <Link
          href="/terminal"
          className="inline-block mt-6 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[var(--bs-gold-2)] to-[var(--bs-gold)] text-[#0a0e17] font-bold hover:brightness-105 transition bs-glow"
        >
          Enter Bill Street →
        </Link>
      </section>
    </div>
  );
}
