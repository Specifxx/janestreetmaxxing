# Backtest — does the ASX200 ORB "$100 → $1,000,000" plan hold up?

**Short answer: the plan only works if the win rate is genuinely ~83%, and that
83% is the one thing we cannot verify with free data. Everything hangs on an
unproven assumption — and the moment you relax it even slightly, the plan
collapses.** This file shows exactly what *can* be tested, what *can't*, and the
numbers from the parts that can.

## What this strategy needs to be backtested properly

The 5-factor system mixes **daily/overnight** signals with **intraday** ones:

| Factor | Signal | Backtestable on free data? |
|--------|--------|----------------------------|
| 1 | Overnight macro (SPI, Wall St, iron ore, AUD, AFR tone) | **Partly** — daily prices yes; AFR tone no |
| 2 | 30-min opening-range break (5-min closes) | **No** — needs years of 5-min ASX200 bars |
| 3 | Nikkei alignment at 10:30 AEST | Partly (daily) |
| 4 | Volume ≥1.4× 10-day avg at the break | **No** — needs intraday volume |
| 5 | 5-min RSI(14) band at entry | **No** — needs 5-min bars |

Free history (Yahoo) gives **daily** bars going back years, but only ~60 days of
**5-minute** bars. So a multi-year test of the *full* stack is impossible without
a paid intraday data vendor. Anyone quoting a backtested 83% on this strategy
either has paid intraday data, or curve-fit it. **We don't fake what we can't
measure.**

So we test the two things we *can*, rigorously:

---

## 1. Monte Carlo — IF the edge is real, does the money plan survive?

`scripts/orb-montecarlo.ts` takes the staking plan exactly as specified
(20× leverage, 1.0% stop, 0.735% base TP, 3.0% runner TP, 80 trades, full
compounding) and runs 100,000 simulated 4-year paths at a range of win rates.

```bash
npx tsx scripts/orb-montecarlo.ts 100000
```

**It reproduces the supplied spec almost exactly** — at 83.3% it gives
P(reach \$1m) = 51.7%, median final \$1.23m, median max drawdown 41.8% — which
confirms the simulator is faithful, then stress-tests the assumption:

| win rate | P(reach \$1m) | median final | median maxDD | 95th-pct maxDD | P(lose money) |
|---------:|--------------:|-------------:|-------------:|---------------:|--------------:|
| **83.3%** (claimed) | **51.7%** | **\$1.23m** | 41.8% | 59.4% | 0.0% |
| 78.0% | 17.6% | \$208.6k | 49.2% | 69.1% | 0.0% |
| 74.0% | 5.5% | \$53.5k | 53.6% | 76.4% | 0.0% |
| 70.0% | 1.3% | \$13.3k | 59.4% | 82.0% | 0.5% |
| 65.0% | 0.1% | \$2.9k | 69.1% | 89.8% | 4.6% |
| 60.0% | 0.0% | \$517 | 78.0% | 95.4% | 20.4% |
| 55.0% | 0.0% | \$106 | 87.2% | 98.5% | 49.9% |

### What this means
- **Even if the 83% is real, it's a coin-flip for the dream** (51.7%), and the
  *typical* path still suffers a **~42% drawdown** — most people abandon a system
  long before that.
- **The plan is brutally sensitive to the win rate.** Drop it just ~9 points to
  74% (still a *great* day-trading hit rate) and the chance of \$1m falls from
  ~52% to **~5.5%**. At a still-respectable 65%, it's **0.1%**.
- This fragility is caused by **20× full compounding**: each loss removes 20.2%
  of the entire account, so a normal losing cluster gouges deep holes that the
  wins have to climb out of. Leverage is doing more here than the signal.

The honest read: the \$100→\$1m story is not a forecast, it's a **bet that the
win rate is ~83% and stays there for 80 trades** — and we have no evidence it is.

---

## 2. Real-data check of the macro base layer (Factor 1)

`scripts/orb-macro-backtest.ts` tests, on real ASX200 daily history with **no
look-ahead**, whether the overnight macro gate actually predicts the ASX200's
next-day direction (the ~58% "base layer" the whole stack is built on).

```bash
npx tsx scripts/orb-macro-backtest.ts   # needs an open network to Yahoo
```

- **Outcome:** did `^AXJO` close up on ASX day *d*?
- **Predictors** (only data completed *before* the ASX open on day *d*):
  Wall St (`^GSPC`, also standing in for SPI futures), `AUDUSD=X`, and iron ore
  via the `BHP` NYSE ADR.
- **Gate:** N of 3 legs clearing their threshold in the same direction → trade
  that way; correct if the ASX closed that way; compared to the base up-rate.

> ⚠️ Reduced proxy: only **3 of the 5** macro legs are reconstructable
> historically (AFR article tone and the exact SPI futures leg are not), so this
> is a *floor* on Factor 1, not the full gate.

**Result on this machine:** could not run — the sandbox blocks outbound network
(`403`). Run it yourself on a normal connection and paste the table back; the
script prints trades taken, directional hit-rate, and edge vs the naive
directional baseline. A positive edge here only validates the ~58% layer — it
still says nothing about the 83%.

---

## Honest conclusion

1. **The 83% headline is unverified and probably unverifiable for free.** It
   relies on three intraday filters that need 5-minute data going back years.
2. **The compounding plan is fragile, not robust.** It clears \$1m on barely half
   of paths *even at the assumed 83%*, with a ~42% typical drawdown, and falls
   apart fast as the win rate drops toward realistic levels.
3. **20× leverage is the dominant risk.** The math that makes \$100→\$1m possible
   is the same math that wipes you out on a normal losing streak.
4. **What would actually de-risk this**, in order:
   - run the macro backtest above to confirm the base layer is even real;
   - **paper-trade the full system live** (the `/orb` desk) for a few months to
     measure your *real* hit rate — that single number decides everything;
   - only then, if it holds, trade tiny size at **2–3×, not 20×**.

**Bottom line:** this is a leveraged bet on an unproven win rate, dressed up as a
plan. The most valuable next step is measuring the real win rate — not funding
the account.
