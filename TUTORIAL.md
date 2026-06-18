# Visual tutorial — using the ASX200 ORB tools

Two ways to use this: the **web checklist** (`/orb`, manual, great for learning)
and the **automated bot** (`scripts/orb-bot.ts`, hands-off, paper by default).

---

## A. The web checklist (`/orb`)

### Step 1 — Start the app and open the page
```bash
npm install
npm run dev
```
Open **http://localhost:3000/orb**. Top of the page:
```
┌────────────────────────────────────────────── ● LIVE ──┐
│  BILL STREET · ASX DAY DESK                  [↻ Refresh] │
│  ASX200 Pre-Bell ORB Signaller                           │
│  Pre-open │ 10:00–10:30 │ Break │ Entry   ← daily timeline│
└──────────────────────────────────────────────────────────┘
```
> `● LIVE` = real prices. `SAMPLE DATA` (amber) = network blocked, don't trade off it.

### Step 2 — Read the verdict bar (it updates as you fill things in)
```
┌──────────────── VERDICT ────────────────┬─── stacked win-rate ───┐
│   NO TRADE                              │        58%             │
│   Macro gate not met — 2/5 aligned…     │   1/5 gates passed     │
└─────────────────────────────────────────┴────────────────────────┘
```
Green **GO · LONG/SHORT** only appears when all 5 gates pass.

### Step 3 — Step 1 panel: overnight macro (auto) + set AFR tone
```
Step 1 · Overnight macro gate            Direction: LONG · 4/5 aligned
 Signal              Overnight  Threshold  Dir   Aligned
 ASX SPI 200 futures  +0.74%     >0.6%     ▲up     ✓
 Wall St (S&P 500)    +0.62%     >0.5%     ▲up     ✓
 Iron ore (proxy)     +1.10%     >0.8%     ▲up     ✓
 AUD/USD              +0.41%     >0.3%     ▲up     ✓
 AFR article tone   [Bullish][Bearish][Mixed]  ←  YOU pick this
```
👉 **You only touch "AFR tone."** Everything else is pulled live.

### Step 4 — Step 2 panel: tick the intraday gates (after 10:30 AEST)
```
Step 2 · Intraday confirmation
 ✓ F2 ORB break      [No break][Closed ABOVE high][Closed BELOW low]
 ✓ F3 Nikkei (auto)  +0.60%  LONG
 ✓ F4 Volume         [Yes ≥1.4×][No]
 ✓ F5 5-min RSI(14)  [ 62 ]  band 40–65
```
Watch your broker's AUS200 5-min chart, mark the 10:00–10:30 range, and tick what
you actually see.

### Step 5 — Verdict flips to GO, then size the trade (Step 3 panel)
```
   GO · LONG          Stacked win-rate 83%

 Step 3 · Position & risk
 Equity $500  Lev 20×  Stop 1.0%  BaseTP 0.735%  RunnerTP 3.0%
 ┌ If stopped −20.2% ┐ ┌ Base win +14.5% ┐ ┌ Runner +59.8% ┐
 │  −$101  → $399    │ │ +$73 → $573      │ │ +$299 → $799  │
 └───────────────────┘ └──────────────────┘ └───────────────┘
 ⚠ Reality check: one stop = −20% of the account; 3 in a row halves it.
```
Only enter when it says **GO**, with the stop from this panel.

---

## B. The automated bot (paper first)

### Step 1 — Prove the pipeline offline (no account, no money)
```bash
npx tsx scripts/orb-bot.ts --demo-data
```
You'll see:
```
[..] mode=paper equity=$500.00
Signal: GO LONG (stacked win-rate 83%)
  ✓ F1 Overnight macro gate: 3/3 legs aligned up (need ≥2)
  ✓ F2 ORB break confirms: Broke long (agrees)
  ✓ F3 Nikkei aligned: +0.60%
  ✓ F4 Volume ≥1.4× avg: 2.00× the 10-day avg
  ✓ F5 RSI not extreme: RSI 62.1 (band 40–65)
→ PAPER LONG @ 7806 | outcome=base | equity now $518.38
Journal: 1 settled trades, win rate 100.0%
```

### Step 2 — Paper-trade live ASX data, automatically
```bash
ORB_EQUITY=500 npx tsx scripts/orb-bot.ts --loop
```
It evaluates every 5 minutes during ASX hours and writes every result to
**`orb-journal.json`**. Leave it running for **months**.

### Step 3 — Read your REAL win rate, then stress-test it
```bash
npx tsx scripts/orb-montecarlo.ts 100000 0.71   # use YOUR journal's win rate
```
```
win rate | P(reach $1m) | median final | median maxDD
  71.0%  |    ~2%       |    ~$18k     |    ~57%
```
👉 This number — *your measured win rate* — decides whether real money is ever
sane. Not the slide's 83%.

### Step 4 — (Only if it works) connect IG demo, then live
```
 PAPER  ──►  IG DEMO (dry-run)  ──►  IG DEMO (real demo orders)  ──►  IG LIVE
 free        scripts/ig-smoke-test     ORB_PLACE_REAL_ORDERS=yes      3 switches
```
Full commands are in **`AUTOMATION.md` → Part 3**. Live needs three deliberate
env switches set together; the adapter refuses orders that over-risk a small
account.

---

## C. One-click in the app (`/autopilot`)

For a no-terminal flow: `npm run dev`, open **http://localhost:3000/autopilot**.
```
1 · Connect   [IG API key][username][password][epic]  (Demo ◉ / Live ○)  [Connect]
              ✓ Connected · 10000 AUD · mode paper
              Australia 200 @ 7800 · min exposure ≈ $3900 · margin ≈ $195 …
2 · Arm & run  Strategy: [ASX200 ORB][Heikin Ashi + Volume Osc.]
               ☐ Actually place orders   ▶ Auto-run every 5 min
3 · Activity   time | mode | win-rate | action | detail
```
- **Defaults to Demo.** Live + "place orders" makes you type a confirmation
  phrase first.
- **Run it locally** — don't paste live broker credentials into a hosted site.
- Auto-run works only while the tab is open; **24/7 needs the CLI bot** (Section B).

## The one rule

> **Green GO is necessary, not sufficient. The journal's measured win rate is the
> only thing that tells you if this makes money. Prove it on paper before a cent
> of real money — the strategy came from a forwarded slide with no source.**
