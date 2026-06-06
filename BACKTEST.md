# Backtest — does the short-term (ODTE) model actually predict next-day moves?

**Short answer: no — not as built.** On a large, real, look-ahead-free test the
model's directional accuracy was **~51.2%**, which is *below* the 52.0% you'd get
by blindly guessing "up" every day. The model does not have a usable forecasting
edge for next-day direction. This file documents exactly how that was measured so
you can re-run and verify it.

## Method (no look-ahead, real data)

- **Data:** S&P 500 daily OHLCV, 2013-02-08 → 2018-02-07 (`plotly/datasets`,
  500 usable tickers).
- **Code under test:** the *actual* production functions `computeIndicators`
  and `shortTermBull` from `src/lib/`, not a reimplementation.
- **Walk-forward:** to predict day *i+1*, the model is fed **only** the trailing
  252 sessions up to and including day *i* (the same 1-year window the live app
  fetches). Day *i+1*'s outcome is never visible. This is exactly your ask —
  "pretend it didn't know yesterday's performance."
- **Sample size:** **491,867 predictions** (one per ticker-day).
- **Outcome:** did the next session close higher than day *i*? Compared against
  the **base rate** (the "always predict up" baseline).

Run it yourself:
```bash
curl -o /tmp/sp500_5yr.csv \
  https://raw.githubusercontent.com/plotly/datasets/master/all_stocks_5yr.csv
npx tsx scripts/backtest.ts /tmp/sp500_5yr.csv
```

## Results

Baseline ("always predict up"): **next-1-day up-rate = 52.02%**, 2-day = 53.18%.
(Above 50% only because 2013-18 was a bull market that drifted up.)

### 1-day direction — "predict UP when P(up) ≥ threshold"
| threshold | calls | hit-rate | edge vs base |
|----------:|------:|---------:|-------------:|
| 0.50 | 300,876 | **51.22%** | **−0.80 pp** |
| 0.55 | 280,001 | 51.17% | −0.85 pp |
| 0.60 | 268,088 | 51.18% | −0.85 pp |

Raising the confidence threshold does **not** improve accuracy — there is no
"high-conviction" subset that works.

### Calibration — actual up-rate by predicted P(up) bin
| P(up) bin | n | actual up-rate |
|----------:|--:|---------------:|
| ~0.20 | 7,406 | **55.82%** |
| ~0.30 | 96,674 | 53.61% |
| ~0.40 | 86,909 | 52.71% |
| ~0.50 | 32,788 | 51.60% |
| ~0.60 | 176,119 | 51.04% |
| ~0.70 | 91,742 | 51.44% |

The relationship is **inverted**: the days the model is *least* bullish actually
closed up *more* often. This is the well-documented **short-term reversal**
effect (yesterday's winners slightly underperform the next day).

### Consequence — fading the model (contrarian)
Predicting UP when **P(up) ≤ ~0.39**: **53.77%** hit-rate (n=104,082), **+1.74 pp**
over base rate. A small but real reversal edge — *the opposite* of how the model
is currently wired.

## Monthly horizon — "predict next month's direction"

Same discipline, longer horizon: to predict calendar month *M*, the model sees
**only** the trailing 252 sessions up to the last trading day of month *M-1*;
months are **non-overlapping** (independent samples). It uses the app's
**price-based factors** — `(Momentum·0.25 + Technicals·0.15)/0.40` — exercised
through the real `momentumScore`/`technicalScore` code. (The Value & Quality
factors aren't included: they need point-in-time fundamentals we don't have.)

- **Sample:** 23,477 ticker-months, 499 tickers.
- **Base rate (month closed up):** **55.77%** (2013-18 was a strong bull market).

| predict UP when score ≥ | calls | accuracy | edge vs base |
|------------------------:|------:|---------:|-------------:|
| 50 | 15,538 | 55.73% | −0.03 pp |
| 55 | 11,559 | 54.81% | −0.96 pp |
| 60 |  9,913 | 54.72% | −1.05 pp |
| 65 |  6,292 | 54.07% | −1.70 pp |

**Overall directional accuracy (up if score ≥ 50, else down): ~51.8%** — *worse*
than the 55.8% you'd get by assuming every month is up (**−3.9 pp**). When the
model flags a month bearish (score < 50), the month still rose 55.8% of the time
— its bearish calls are uninformative.

Calibration is again **inverted**: the lowest-momentum bin (score ~30) had the
*highest* forward return (**+1.48%/month**, 56.9% up) while the highest bins
(60-70) returned ~0.55%/month — the medium-term reversal effect showing up at
monthly horizon too.

## Honest conclusion

1. **As-built, the ODTE direction model is not predictive** (≈51% ≈ coin flip,
   slightly worse than the up-drift baseline). Do **not** trade it expecting an
   edge. Treat the ODTE page as an exploratory screen, not a signal.
2. The model's logic is **momentum-tilted**, but next-day equity moves are mildly
   **mean-reverting**, so its confidence points the wrong way. A contrarian
   reversal version showed ~+1.7 pp — but:
   - that's **in-sample** (2013-18) and needs out-of-sample / walk-forward-CV
     validation before trusting it;
   - **~1.7 pp is likely below trading costs** (spread + brokerage + slippage),
     so it is not obviously profitable for a retail account;
   - it says nothing about *magnitude* — direction ≠ money.
3. **Not tested here:** the valuation/composite (Buy/Sell) model, because an
   honest backtest needs **point-in-time fundamentals** (historical EPS, FCF,
   analyst targets as they were *then*). We only have today's fundamentals;
   applying them to the past would be look-ahead bias, so it was deliberately
   excluded rather than faked.
4. **Coverage caveats:** US large-caps only (this free dataset has no ASX), one
   bull-market regime, gross of costs, daily closes only (no intraday/overnight
   gap split).

**Bottom line:** short-term direction is extremely hard to forecast and this
model doesn't beat a coin flip. The most defensible next step is the reversal
signal — but only after proper out-of-sample testing and a realistic cost model.
I'd treat any "this will make a lot of money" claim about the current ODTE
feature as unsupported by this evidence.
