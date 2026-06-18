# Alpha Engine — Quant Stock & ODTE Screener (US + ASX)

A formula-driven stock analysis web app that ranks **US** and **Australian (ASX)**
equities by a transparent 5-factor model, blends four valuation models into a
price target, and runs a short-horizon **ODTE (0–2 day) upside radar** that
filters out names which have *already* made their expected move.

Built for someone who trades US + ASX on **Stake**. Everything is computed from
primary data with published formulas — no black boxes, and **every number shows
its working**.

> ⚠️ **Not financial advice.** This is an educational quant tool. Models use
> noisy inputs and fixed priors; they cannot predict news, gaps, or regime
> shifts. You can lose money. Do your own research.

## What it does

| Page | What you get |
|------|--------------|
| **/** Screener | Ranked opportunities across US/ASX with composite score, recommendation, blended price target, upside %, and the top driving factor. Search any symbol (`AAPL`, `BHP.AX`). |
| **/stock/[symbol]** | Full report: score ring, factor breakdown, 6-month price chart with bull/base/bear target lines, four valuation models **with formulas + inputs**, key stats, bullish reasoning, and risks. |
| **/odte** | 1–2 day upside radar: probability-of-up model, expected daily move from implied vol, suggested target, **remaining headroom**, and an "already moved" exclusion list. |
| **/orb** | ASX200 pre-bell **opening-range-breakout** signaller: a guided 5-factor checklist (live overnight macro gate + intraday confirmation), the conditional win-rate stack, a hard **GO / NO-TRADE** verdict, and a leverage-aware position/risk calculator with an honest ruin reality-check. |
| **/methodology** | Every formula and weight, written out. |

**Automated ORB bot:** [`AUTOMATION.md`](AUTOMATION.md) — a fully-automated,
paper-trading-by-default ASX200 ORB bot (`scripts/orb-bot.ts`) with a signal
engine, risk guardrails, a trade journal that measures your *real* win rate, and
a gated path to live broker execution. Novice-friendly setup + honest risk
considerations.

**Backtests:** [`BACKTEST.md`](BACKTEST.md) (ODTE direction model) and
[`ORB-BACKTEST.md`](ORB-BACKTEST.md) (the ASX200 ORB "$100→$1m" plan — a Monte
Carlo stress-test + a real-data check of the overnight-macro base layer, with
honest caveats about what intraday data we can't get).

## The models (see `/methodology` in-app for full detail)

- **Composite score** = `0.30·Value + 0.25·Momentum + 0.20·Quality + 0.15·Technicals + 0.10·Sentiment`
- **Price target** = `0.35·DCF + 0.25·EarningsPower + 0.25·Analyst + 0.15·Graham`
  - 2-stage DCF with CAPM discount rate `r = 4% + β·5%`
  - Graham number `√(22.5·EPS·BVPS)`
  - Forward EPS × PEG-anchored justified P/E
  - Sell-side analyst consensus
- **Technicals**: SMA/EMA, Wilder RSI(14), MACD(12,26,9), Bollinger(20,2σ), ATR(14), annualised HV.
- **ODTE**: expected move `σ₁d = IV/√252`; `P(up)` via a logistic over trend/MACD/RSI-zone/prior-close factors; bullish target `0.8σ`; **excluded when** `move-since-prev-close ≥ target` (edge spent).

## Data sources

- **Yahoo Finance** (unofficial JSON endpoints) — quotes, daily history,
  fundamentals (`quoteSummary`), and option-chain implied vol. Handles the
  cookie/crumb auth automatically. Covers US and ASX (`.AX`).
- **Reddit** (`r/wallstreetbets`, `r/stocks`, `r/ASX_Bets`, …) for retail
  sentiment — deliberately the *smallest* weight, since it's a weak lagging
  signal.

### Offline / restricted-network fallback
If the live feeds are unreachable (e.g. a locked-down CI/sandbox network), the
app transparently serves **clearly-labelled deterministic SAMPLE DATA** so the
interface and full pipeline still work. Sample mode is tagged everywhere with an
amber `SAMPLE DATA` badge. **Never trade off sample numbers** — run it on a normal
network to get the `● LIVE` badge.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
# production:
npm run build && npm run start
```

Requires Node 18+. No API keys needed.

## Deploy for free (~2 minutes) — get a shareable `*.vercel.app` URL

This app uses server-side API routes, so it needs a host that runs Next.js
functions. **Vercel's Hobby tier is free and ideal** (Netlify also works).

1. Go to **https://vercel.com** and sign in **with GitHub**.
2. Click **Add New… → Project**, then **Import** the `Specifxx/janestreetmaxxing`
   repository. (Production branch is `main` — already set.)
3. Framework preset auto-detects **Next.js**. No env vars or build settings to
   change. Click **Deploy**.
4. ~1 minute later you get a public URL like `https://billstreet-xxx.vercel.app`
   to share. Rename the project to `billstreet` in **Settings → General** for a
   cleaner `https://billstreet.vercel.app`.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Specifxx/janestreetmaxxing)

**Live data on the deployed site:** Vercel's network is open, so it fetches real
US + ASX prices from Yahoo. If Yahoo rate-limits the cloud IP, the app falls back
to the clearly-labelled **SAMPLE DATA** badge — the site still works, it just
isn't live in that moment.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Recharts.
Analysis engine is in `src/lib/analysis/*` (pure functions, easy to extend/test);
data providers in `src/lib/providers/*`; orchestration in `src/lib/engine.ts`.

## Extending
- Add tickers in `src/lib/universe.ts`.
- Tune factor weights in `src/lib/analysis/score.ts`, valuation blend in
  `src/lib/analysis/valuation.ts`, and ODTE priors in `src/lib/analysis/odte.ts`.
