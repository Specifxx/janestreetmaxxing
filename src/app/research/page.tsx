import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Research & Backtests — Bill Street",
  description:
    "Bill Street's full quantitative methodology and walk-forward backtests on ~500k real predictions.",
};

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <code className="block mono text-sm text-[var(--color-accent)] bg-[var(--color-bg)] rounded-lg p-3 my-2 overflow-x-auto">
      {children}
    </code>
  );
}

function Section({ title, kicker, children }: { title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section className="panel p-6">
      {kicker && <div className="text-xs font-medium tracking-widest text-[var(--bs-gold)] uppercase mb-1">{kicker}</div>}
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-[var(--color-muted)] leading-relaxed">{children}</div>
    </section>
  );
}

export default function Research() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="panel p-8 bs-glow">
        <div className="text-xs font-medium tracking-widest text-[var(--bs-gold)] uppercase mb-2">
          Bill Street Research
        </div>
        <h1 className="text-3xl font-bold">Methodology &amp; backtests</h1>
        <p className="text-[var(--color-muted)] mt-2">
          The whole firm is built on one principle: every call is reproducible from public data and
          published maths. Below is exactly how the models work — and how they actually performed on
          half a million real, look-ahead-free predictions.
        </p>
      </div>

      {/* BACKTESTS FIRST — honesty up front */}
      <Section kicker="Verified, not promised" title="Backtest 1 — short-horizon direction (1-day)">
        <p>
          Walk-forward on <strong className="text-[var(--color-text)]">491,867</strong> real predictions
          (S&amp;P 500 daily, 2013-2018). To predict day <em>i+1</em> the model saw only the trailing
          252 sessions up to day <em>i</em> — no look-ahead. We measured how often &quot;predict up&quot;
          was right vs the unconditional base rate.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs mono mt-2">
            <thead className="text-[var(--color-muted)] uppercase">
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-2">Predict up when P(up) ≥</th>
                <th className="text-right py-2">calls</th>
                <th className="text-right py-2">hit-rate</th>
                <th className="text-right py-2">edge vs base</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["0.50", "300,876", "51.22%", "−0.80pp"],
                ["0.55", "280,001", "51.17%", "−0.85pp"],
                ["0.60", "268,088", "51.18%", "−0.85pp"],
              ].map((r) => (
                <tr key={r[0]} className="border-b border-[var(--color-border)]/50">
                  <td className="py-2 text-[var(--color-text)]">{r[0]}</td>
                  <td className="py-2 text-right">{r[1]}</td>
                  <td className="py-2 text-right">{r[2]}</td>
                  <td className="py-2 text-right down">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Base rate (always-up) was 52.0%. <strong className="text-[var(--color-text)]">The naïve
          momentum signal does not beat a coin flip.</strong> Calibration was in fact <em>inverted</em>
          — the model&apos;s least-bullish days rose <em>more</em> often (a short-term reversal effect),
          and fading the model scored ~53.8% (+1.7pp in-sample).
        </p>
      </Section>

      <Section kicker="Verified, not promised" title="Backtest 2 — monthly direction">
        <p>
          Same discipline, longer horizon: predict each non-overlapping calendar month from data up to
          the prior month-end, using the app&apos;s price-based factors. <strong className="text-[var(--color-text)]">23,477</strong> ticker-months.
        </p>
        <Formula>Overall directional accuracy ≈ 51.8%   vs   55.8% always-up base rate  (−3.9pp)</Formula>
        <p>
          The momentum/technical factors alone don&apos;t forecast monthly direction either, and the
          reversal pattern repeats. The <em>value &amp; quality</em> factors — the part most likely to
          add medium-term edge — can&apos;t be backtested without point-in-time fundamentals, so we
          deliberately don&apos;t claim a number we can&apos;t verify.
        </p>
        <p className="text-[var(--color-text)]">
          Why show this? Because a firm that only publishes winners is selling a story. We&apos;re
          building on evidence. The honest finding (markets mean-revert short-term, momentum is
          over-rated at these horizons) is exactly what shapes the next iteration.
        </p>
      </Section>

      {/* METHODOLOGY */}
      <Section kicker="The maths" title="Composite opportunity score (0-100)">
        <p>Five orthogonal factor buckets, each scored 0-100, combined by weight:</p>
        <Formula>Score = 0.30·Value + 0.25·Momentum + 0.20·Quality + 0.15·Technicals + 0.10·Sentiment</Formula>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-[var(--color-text)]">Value</strong> — upside to blended fair value, plus cheap/rich P/E &amp; PEG nudges.</li>
          <li><strong className="text-[var(--color-text)]">Momentum</strong> — price vs SMA50/200 trend stack, 3-month return, RSI regime.</li>
          <li><strong className="text-[var(--color-text)]">Quality</strong> — ROE, net margin, Debt/EBITDA leverage.</li>
          <li><strong className="text-[var(--color-text)]">Technicals</strong> — MACD histogram, Bollinger position, distance from 52-week high.</li>
          <li><strong className="text-[var(--color-text)]">Sentiment</strong> — sell-side consensus blended with Reddit retail buzz (smallest weight).</li>
        </ul>
      </Section>

      <Section kicker="The maths" title="Price targets — model blend">
        <Formula>FairValue = 0.35·DCF + 0.25·EarningsPower + 0.25·Analyst + 0.15·Graham</Formula>
        <p className="text-[var(--color-text)] font-medium pt-1">Two-stage discounted cash flow</p>
        <Formula>FV = Σₜ₌₁ᴺ FCFₜ/(1+r)ᵗ + [FCF_N·(1+g₂)/(r−g₂)]/(1+r)ᴺ</Formula>
        <p>FCF grows at g₁ (≤20%) for 5 years, then a 2.5% terminal value. Discount rate is a CAPM build-up <code className="mono">r = 4% + β·5%</code>; per-share = (PV − net debt) / shares.</p>
        <p className="text-[var(--color-text)] font-medium pt-1">Graham number</p>
        <Formula>FV = √(22.5 × EPS × BookValuePerShare)</Formula>
        <p className="text-[var(--color-text)] font-medium pt-1">Forward earnings power (PEG-anchored)</p>
        <Formula>FV = ForwardEPS × justifiedP/E,  justifiedP/E = growth% (PEG = 1)</Formula>
      </Section>

      <Section kicker="The maths" title="ODTE — short-horizon expected move">
        <Formula>σ₁d = AnnualVol / √252 ,  ExpectedMove% = σ₁d × 100 ,  σ₂d = σ₁d·√2</Formula>
        <Formula>P(up) = 1 / (1 + e^(−z)),  z = Σ wᵢ·factorᵢ</Formula>
        <p>
          The desk excludes names that have already run past their target: if the move since the
          previous close ≥ 0.8σ, the asymmetric entry is spent and it&apos;s filtered out.
        </p>
      </Section>

      <Section kicker="Honesty" title="Limitations we won't hide">
        <ul className="list-disc pl-5 space-y-1">
          <li>Data is Yahoo Finance (unofficial, delayed) + Reddit; sample data is used and clearly labelled when feeds are down.</li>
          <li>Backtests are US large-caps, one bull-market regime, gross of trading costs and spreads.</li>
          <li>No model reliably predicts short-term prices. These are probabilistic estimates, not advice.</li>
          <li>Bill Street is not a licensed adviser. You can lose money. Size positions accordingly.</li>
        </ul>
        <p>
          Run the backtests yourself: <code className="mono">npx tsx scripts/backtest.ts</code> and{" "}
          <code className="mono">scripts/backtest-monthly.ts</code>.
        </p>
        <Link href="/terminal" className="inline-block mt-2 text-[var(--color-accent)] font-medium">
          ← Back to the terminal
        </Link>
      </Section>
    </div>
  );
}
