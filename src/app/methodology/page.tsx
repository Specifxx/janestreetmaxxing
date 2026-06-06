import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — Alpha Engine",
};

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <code className="block mono text-sm text-[var(--color-accent)] bg-[var(--color-bg)] rounded-lg p-3 my-2 overflow-x-auto">
      {children}
    </code>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-6">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-[var(--color-muted)] leading-relaxed">{children}</div>
    </section>
  );
}

export default function Methodology() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="panel p-8">
        <h1 className="text-3xl font-bold">Methodology</h1>
        <p className="text-[var(--color-muted)] mt-2">
          Everything here is computed from primary market data with published formulas — no black boxes. The goal is
          a defensible, auditable estimate of where edge may exist, not a crystal ball.
        </p>
      </div>

      <Section title="1. Composite opportunity score (0-100)">
        <p>Five orthogonal factor buckets, each scored 0-100, combined by weight:</p>
        <Formula>Score = 0.30·Value + 0.25·Momentum + 0.20·Quality + 0.15·Technicals + 0.10·Sentiment</Formula>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-[var(--color-text)]">Value</strong> — upside to blended fair value, plus cheap/rich P/E &amp; PEG nudges.</li>
          <li><strong className="text-[var(--color-text)]">Momentum</strong> — price vs SMA50/200 trend stack, 3-month return, RSI regime.</li>
          <li><strong className="text-[var(--color-text)]">Quality</strong> — ROE, net margin, Debt/EBITDA leverage.</li>
          <li><strong className="text-[var(--color-text)]">Technicals</strong> — MACD histogram, Bollinger position, distance from 52-week high.</li>
          <li><strong className="text-[var(--color-text)]">Sentiment</strong> — sell-side consensus (1-5) blended with Reddit retail buzz (small weight).</li>
        </ul>
        <p>
          The recommendation label is gated by upside: a name needs both a high score <em>and</em> headroom to fair
          value before it is tagged Buy / Strong Buy.
        </p>
      </Section>

      <Section title="2. Price targets — model blend">
        <p>Four independent valuation models, blended by reliability weight:</p>
        <Formula>FairValue = 0.35·DCF + 0.25·EarningsPower + 0.25·Analyst + 0.15·Graham</Formula>

        <p className="text-[var(--color-text)] font-medium pt-2">Two-stage discounted cash flow</p>
        <Formula>FV = Σₜ₌₁ᴺ FCFₜ/(1+r)ᵗ + [FCF_N·(1+g₂)/(r−g₂)]/(1+r)ᴺ</Formula>
        <p>
          FCF grows at g₁ (capped 20%) for N=5 years, then a Gordon terminal value at g₂=2.5%. The discount rate is a
          CAPM build-up <code className="mono">r = 4% + β·5%</code>. Per-share = (enterprise PV − net debt) / shares.
        </p>

        <p className="text-[var(--color-text)] font-medium pt-2">Graham number</p>
        <Formula>FV = √(22.5 × EPS × BookValuePerShare)</Formula>

        <p className="text-[var(--color-text)] font-medium pt-2">Forward earnings power (PEG-anchored)</p>
        <Formula>FV = ForwardEPS × justifiedP/E,  justifiedP/E = growth% (PEG = 1)</Formula>

        <p className="text-[var(--color-text)] font-medium pt-2">Analyst consensus</p>
        <p>Mean sell-side 12-month price target. Bull/bear bands come from model dispersion plus a volatility cushion.</p>
      </Section>

      <Section title="3. Technical indicators">
        <ul className="list-disc pl-5 space-y-1">
          <li>SMA/EMA (20/50/200, 12/26) for trend.</li>
          <li>Wilder RSI(14) for overbought/oversold regime.</li>
          <li>MACD(12,26,9) histogram for momentum turns.</li>
          <li>Bollinger Bands (20, 2σ) for stretch.</li>
          <li>ATR(14) and 20-day annualised historical volatility <code className="mono">σ·√252</code>.</li>
        </ul>
      </Section>

      <Section title="4. ODTE — short-horizon up-move model">
        <p>Expected one-sigma daily move from implied (or historical) volatility:</p>
        <Formula>σ₁d = AnnualVol / √252 ,  ExpectedMove% = σ₁d × 100 ,  σ₂d = σ₁d·√2</Formula>
        <p>Probability the next session closes higher, via a logistic over short-term factors:</p>
        <Formula>P(up) = 1 / (1 + e^(−z)),  z = Σ wᵢ·factorᵢ</Formula>
        <p>
          Factors: above/below SMA20, MACD sign, RSI zone (45-65 constructive, &lt;30 oversold bounce, &gt;75
          exhaustion), 1-month drift, and where price closed within yesterday&apos;s range.
        </p>
        <p>
          <strong className="text-[var(--color-warn)]">The &quot;already moved&quot; filter:</strong> the bullish target is
          0.8σ. If a stock&apos;s move since the previous close already meets or exceeds that target (or the full
          expected move), its asymmetric edge is spent, so it is excluded from the actionable list and shown under
          &quot;already moved&quot; with the headroom calculation:
        </p>
        <Formula>Headroom% = 0.8σ − ChangeSincePrevClose% ;  excluded if Headroom ≤ 0</Formula>
      </Section>

      <Section title="5. Data &amp; honest limitations">
        <ul className="list-disc pl-5 space-y-1">
          <li>Prices, fundamentals and option IV: Yahoo Finance (unofficial, delayed) for US and ASX (.AX).</li>
          <li>Retail sentiment: Reddit (r/wallstreetbets, r/stocks, r/ASX_Bets, …) — a weak, lagging signal, hence the smallest weight.</li>
          <li>When live feeds are unreachable the app uses clearly-labelled <span className="text-[var(--color-warn)]">SAMPLE DATA</span> so the interface still works — never trade off sample numbers.</li>
          <li>Models rely on noisy inputs and fixed priors; they are <em>not</em> fit to your risk tolerance and cannot predict news, gaps or regime shifts.</li>
        </ul>
        <p className="text-[var(--color-text)]">
          This is an educational quant tool, not financial advice. No model reliably predicts short-term prices;
          treat every output as one input among many and manage risk.
        </p>
      </Section>
    </div>
  );
}
