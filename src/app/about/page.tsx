import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Firm — Bill Street",
  description: "What Bill Street is, why it exists, and how it competes.",
};

export default function About() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="panel p-8 bs-glow">
        <div className="text-xs font-medium tracking-widest text-[var(--bs-gold)] uppercase mb-2">
          The firm
        </div>
        <h1 className="text-3xl font-bold">
          Bill <span className="bs-gradient-text">Street</span>
        </h1>
        <p className="text-lg text-[var(--color-text)] mt-3 font-medium">
          A one-person quantitative trading firm, with a research desk that punches far above its
          account size.
        </p>
      </div>

      <section className="panel p-6 space-y-3 text-sm text-[var(--color-muted)] leading-relaxed">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">The manifesto</h2>
        <p>
          The famous quant shops win with capital, co-located servers and armies of PhDs. We&apos;ll
          never beat them at speed. But most of their <em>edge</em> isn&apos;t magic — it&apos;s
          discipline: defined process, valuation done properly, risk respected, and decisions made by
          maths instead of mood. That part is not gated behind a billion-dollar balance sheet.
        </p>
        <p>
          Bill Street packages that discipline into a platform a single person can run on a Stake
          account. The same DCF a sell-side analyst builds in a weekend spreadsheet, the same factor
          tilts the big funds harvest, the same volatility-based expected moves the options desks
          price — computed transparently, on demand, for US &amp; ASX names.
        </p>
        <p className="text-[var(--color-text)]">
          We are deliberately honest about what we don&apos;t know. Our own backtests show the naïve
          momentum signal doesn&apos;t beat a coin flip at short horizons. We publish that. A firm that
          hides its losing tests is a marketing company; a firm that learns from them is a research
          desk.
        </p>
      </section>

      <section className="grid sm:grid-cols-3 gap-4">
        {[
          { t: "Process over prediction", d: "We don't promise to call tops and bottoms. We stack repeatable, positive-expectancy decisions and let probability work." },
          { t: "Transparency as moat", d: "Every formula, input and backtest is published. If you can't audit it, we won't ship it." },
          { t: "Risk first", d: "Recommendations are gated by upside-to-fair-value and framed with explicit risks. Capital preservation before heroics." },
        ].map((c) => (
          <div key={c.t} className="bs-card p-5">
            <div className="font-semibold">{c.t}</div>
            <p className="text-xs text-[var(--color-muted)] mt-2 leading-relaxed">{c.d}</p>
          </div>
        ))}
      </section>

      <section className="panel p-6 space-y-3 text-sm text-[var(--color-muted)] leading-relaxed">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">Built by Claude, end to end</h2>
        <p>
          The entire stack — data ingestion, the valuation and factor engine, the ODTE expected-move
          desk, the walk-forward backtest harness and this site — was designed and written by Claude
          (Anthropic) in TypeScript on Next.js. It&apos;s engineered to be read, audited and extended,
          not to impress with opacity.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {["Next.js", "TypeScript", "Tailwind", "Recharts", "Yahoo Finance", "Reddit", "S&P 500 backtests"].map((t) => (
            <span key={t} className="bs-chip px-3 py-1 text-xs text-[var(--color-text)]">{t}</span>
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold mb-2">A straight word on the &quot;millions&quot;</h2>
        <p className="text-sm text-[var(--color-muted)] leading-relaxed">
          No website can guarantee profit, and anyone who tells you otherwise is selling something.
          What Bill Street gives you is an institutional-grade <em>research process</em> at zero cost,
          with the maths exposed so you can trust it or challenge it. Whether it makes money depends on
          your strategy, your discipline and the market. Trade small, manage risk, and treat every
          output as one input among many — not a promise.
        </p>
        <Link href="/terminal" className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-white font-semibold hover:brightness-110 transition">
          Open the Terminal →
        </Link>
      </section>
    </div>
  );
}
