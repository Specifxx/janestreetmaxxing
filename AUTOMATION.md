# Running the ASX200 ORB bot — a novice-friendly guide

This explains, in plain language, how to run the automated bot, and the honest
considerations before you ever connect real money.

> ## Read this first (the 60-second truth)
> - The bot is **real and automated** — it pulls live data, computes all 5
>   factors itself, sizes a position, manages a stop, and logs every trade. No
>   manual ticking.
> - It **defaults to PAPER MODE** (fake money). That is on purpose. Your own
>   backtest (`ORB-BACKTEST.md`) showed that pointing 20× leverage at this
>   *unproven* edge and walking away ends at **\$0 more often than \$1m**.
> - "Deposit \$500 and let it run" with real money is the **last** step, not the
>   first — and only if paper trading proves a real, positive win rate over
>   *dozens* of trades. The whole plan lives or dies on that one number.
> - In Australia, retail index CFDs are capped at **20:1 leverage by ASIC**, and
>   ASIC's own data shows the **majority of retail CFD traders lose money**. This
>   is legal, but it is gambling-adjacent unless you have a measured edge.

---

## Part 1 — Run it on paper today (no money, ~10 minutes)

You need **Node.js 18+** (https://nodejs.org, click the LTS button).

```bash
# get the code
git clone https://github.com/Specifxx/janestreetmaxxing.git
cd janestreetmaxxing
git checkout claude/clever-ritchie-2t35rv
npm install

# prove the whole pipeline works offline with a synthetic day:
npx tsx scripts/orb-bot.ts --demo-data

# run it for real (paper money, live ASX data) — once per call:
ORB_EQUITY=500 npx tsx scripts/orb-bot.ts

# let it poll automatically every 5 min during ASX hours (10:00–16:00 AEST):
ORB_EQUITY=500 npx tsx scripts/orb-bot.ts --loop
```

What happens each run:
1. It fetches today's 5-minute ASX200 (`^AXJO`) bars + the overnight macro
   (`^GSPC`, `AUDUSD=X`, `BHP`, `^N225`).
2. It evaluates the 5 factors and prints a GO / NO-TRADE verdict with each
   factor's reasoning.
3. On a GO, it opens a **paper** position, resolves it against the real
   intraday price path, and writes the result to **`orb-journal.json`**.

### The journal IS the experiment
`orb-journal.json` accumulates every signal and outcome and prints your running
win rate. **This is the point of the whole exercise.** Let it run for *months* of
trading days. Then take the win rate it reports and plug it into the stress test:

```bash
npx tsx scripts/orb-montecarlo.ts 100000 0.71   # e.g. if your real rate is 71%
```

If your measured win rate isn't comfortably in the high-70s+, the \$100→\$1m plan
is not viable and going live would just be paying to find that out.

> ⚠️ The bot drops the "AFR article tone" leg (Factor 1's 5th input) because
> there's no reliable free news-sentiment feed. The automated macro gate uses the
> 3 price-based legs (Wall St, AUD, iron-ore proxy) and requires ≥2 aligned.
> That's a real deviation from the slide — keep it in mind.

---

## Part 2 — Brokers in Australia (when/if you go live)

To trade the ASX200 at leverage you need a **CFD account** (a Contract for
Difference). Plain things to know:

- **Your Stake account can't do this.** Stake is share trading — no index CFDs,
  no leverage, no automation API.
- **20× is the legal ceiling, not a choice.** ASIC caps retail index CFD leverage
  at 20:1.
- **Brokers with automation, used in AU:**
  | Broker | How you automate | Notes |
  |--------|------------------|-------|
  | **IG** | REST API (Node/TS) | Free demo account; "Australia 200" CFD; the `IGBroker` stub in this repo targets it |
  | **Pepperstone / IC Markets** | MetaTrader 4/5 "Expert Advisor" (MQL) | Different language; huge community of examples |
  | **CMC Markets** | API / MT4 | Established AU broker |
  | **Interactive Brokers** | Full API + *real* SPI 200 **futures** | Most pro, but futures margin is **thousands** per contract — \$500 isn't enough |

  **Every one of these offers a free demo account with virtual money.** Use it.
  Point the bot at the broker's *demo* API first and confirm it places and closes
  orders correctly before risking a cent.

---

## Part 3 — Going live (the deliberate, gated path)

The bot talks to a `Broker` interface (`src/lib/orb/broker.ts`). `PaperBroker` is
the default. To go live you:

1. **Open a broker demo account** (e.g. IG demo) and get an API key.
2. **Implement the two stubbed methods** in `IGBroker` (`getAccount`,
   `openPosition`) against IG's REST API — login via `/session`, place orders via
   `/positions/otc` with an attached OCO stop + limit. *Test every path on the
   demo account.*
3. Run the bot pointed at the **demo** for weeks. Reconcile its journal against
   the broker's own trade history — they must match.
4. Only then, switch to live by setting the env confirmation the code demands:
   ```bash
   export LIVE_TRADING_CONFIRMED=I_UNDERSTAND_I_CAN_LOSE_EVERYTHING
   ```
   This friction is intentional. If that sentence makes you hesitate, you aren't
   ready to go live.

### Guardrails that are ON by default (`src/lib/orb/risk.ts`)
- Risk only **25% of the account per trade**, not 100% (the spec's full
  compounding is what makes the ruin math so brutal).
- **Halt after 3 losses in a row.**
- **Halt for the day after a 20% account loss.**
- **One open position at a time.**

You can edit these — but the defaults exist because the backtest showed why.

---

## Part 4 — Considerations a novice usually misses

- **Costs eat breakout strategies.** Every trade pays the **spread**, and you buy
  *into* a volume surge so you get **slippage** (a worse fill than the signal
  price). Hold a CFD overnight and you pay **financing/swap**. Model these — the
  paper bot currently does *not* charge them, so real results will be worse.
- **Gaps blow through stops.** A "1% stop" is not a guaranteed 1% loss. News
  gaps, halts and thin liquidity can fill you far worse — your loss can exceed
  the stop, and with leverage can exceed your deposit. (Most AU retail brokers
  offer **negative-balance protection** — confirm yours does.)
- **"Set and forget" is operationally fragile.** Your laptop sleeps, wifi drops,
  the API rate-limits, a token expires — and the bot misses an exit. Real bots
  run on an always-on **VPS** with monitoring, alerts, and a **kill-switch**, and
  even then they need babysitting. Truly unattended leveraged trading is how
  accounts die quietly overnight.
- **Tax.** In Australia, CFD profits are generally taxed as **ordinary income**
  (not CGT), and losses may be deductible — keep every record and talk to an
  accountant / read the **ATO** guidance.
- **Regulation & reality.** CFDs are high-risk leveraged derivatives. **ASIC's
  own published data has retail CFD clients losing money the majority of the
  time.** This guide is educational, not financial advice, and I'm not a licensed
  adviser.

---

## The one-line recommendation

**Run the paper bot for a few months, read the win rate off the journal, and let
*that* number — not a marketing slide — decide whether real money ever goes in.
If it does, start at 2–3× leverage and a tiny size, not 20× and your whole \$500.**
