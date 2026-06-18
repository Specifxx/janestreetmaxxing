/*
 * ASX200 ORB bot — automated runner.
 *
 * Pipeline: fetch data -> evaluate the 5-factor signal -> risk checks -> (paper)
 * open + resolve a position against real intraday prices -> journal the outcome
 * and update the running win rate.
 *
 * DEFAULT = PAPER MODE (virtual money). This is the only mode you should run
 * unattended until the journal shows a real positive edge over many trades.
 *
 * Usage:
 *   npx tsx scripts/orb-bot.ts                # one paper evaluation, live data
 *   npx tsx scripts/orb-bot.ts --demo-data    # offline: synthetic day, proves the pipeline
 *   npx tsx scripts/orb-bot.ts --loop         # poll every 5 min during ASX hours
 *
 * Going live is a separate, deliberate step — see AUTOMATION.md. It requires a
 * broker adapter and an explicit env confirmation; this script will not place
 * real-money orders by default.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { evaluateSignal, type Bar5m, type OvernightMacro } from "@/lib/orb/signal";
import {
  DEFAULT_RISK,
  preTradeCheck,
  buildTradePlan,
  applyOutcome,
  type RiskState,
} from "@/lib/orb/risk";
import { PaperBroker } from "@/lib/orb/broker";

const JOURNAL = process.env.ORB_JOURNAL || "orb-journal.json";
const START_EQUITY = Number(process.env.ORB_EQUITY || 500);
const DEMO = process.argv.includes("--demo-data");
const LOOP = process.argv.includes("--loop");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ---- Journal ---------------------------------------------------------------
interface JournalEntry {
  date: string;
  mode: string;
  direction: string;
  outcome: "base" | "runner" | "loss" | "no-trade";
  reason: string;
  equityAfter: number;
}
interface Journal {
  startEquity: number;
  equity: number;
  state: RiskState;
  trades: JournalEntry[];
}

function loadJournal(): Journal {
  if (existsSync(JOURNAL)) return JSON.parse(readFileSync(JOURNAL, "utf8"));
  const state: RiskState = {
    equity: START_EQUITY,
    consecutiveLosses: 0,
    realisedTodayPct: 0,
    openTrades: 0,
    halted: false,
  };
  return { startEquity: START_EQUITY, equity: START_EQUITY, state, trades: [] };
}
function saveJournal(j: Journal) {
  writeFileSync(JOURNAL, JSON.stringify(j, null, 2));
}

// ---- Data ------------------------------------------------------------------
async function yahoo(path: string): Promise<any> {
  const res = await fetch("https://query1.finance.yahoo.com" + path, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}
function sydneyISO(epochSec: number): string {
  // YYYY-MM-DDTHH:MM in Sydney local time (good enough for HH:MM matching)
  const d = new Date(epochSec * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

async function fetch5m(symbol: string): Promise<Bar5m[]> {
  const data = await yahoo(`/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=60d`);
  const r = data?.chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0] ?? {};
  const bars: Bar5m[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null) continue;
    bars.push({
      time: sydneyISO(ts[i]),
      high: q.high?.[i] ?? q.close[i],
      low: q.low?.[i] ?? q.close[i],
      close: q.close[i],
      volume: q.volume?.[i] ?? 0,
    });
  }
  return bars;
}
async function dailyPct(symbol: string): Promise<number> {
  const data = await yahoo(`/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`);
  const r = data?.chart?.result?.[0];
  const c: number[] = (r?.indicators?.quote?.[0]?.close ?? []).filter((x: number) => x != null);
  if (c.length < 2) return 0;
  return ((c[c.length - 1] - c[c.length - 2]) / c[c.length - 2]) * 100;
}

// ---- Synthetic day for offline pipeline proof ------------------------------
function demoData(): { today: Bar5m[]; history: Bar5m[]; macro: OvernightMacro } {
  const day = "2026-06-15";
  const history: Bar5m[] = [];
  for (let d = 1; d <= 10; d++) {
    for (let i = 0; i < 12; i++) {
      const hh = String(10 + Math.floor((i * 5) / 60)).padStart(2, "0");
      const mm = String((i * 5) % 60).padStart(2, "0");
      history.push({ time: `2026-06-${String(d).padStart(2, "0")}T${hh}:${mm}`, high: 7800, low: 7790, close: 7795, volume: 1000 });
    }
  }
  const today: Bar5m[] = [];
  let px = 7800;
  for (let i = 0; i < 12; i++) {
    const hh = String(10 + Math.floor((i * 5) / 60)).padStart(2, "0");
    const mm = String((i * 5) % 60).padStart(2, "0");
    // first 6 bars range ~7795-7805, then break UP on big volume
    if (i < 6) px = 7800 + (i % 2 === 0 ? 3 : -3);
    else px = 7806 + (i - 6) * 4; // breaks above 7805 ORB high
    today.push({ time: `${day}T${hh}:${mm}`, high: px + 2, low: px - 2, close: px, volume: i === 6 ? 2000 : 1100 });
  }
  return { today, history, macro: { wallStPct: 0.7, audPct: 0.4, ironPct: 1.1, nikkeiPct: 0.6 } };
}

// Resolve a paper trade against the remaining intraday bars.
function resolvePaper(
  entryIdx: number,
  bars: Bar5m[],
  plan: { direction: "long" | "short"; stopPrice: number; baseTpPrice: number; runnerTpPrice: number },
): "base" | "runner" | "loss" {
  const long = plan.direction === "long";
  for (let i = entryIdx + 1; i < bars.length; i++) {
    const b = bars[i];
    const hitStop = long ? b.low <= plan.stopPrice : b.high >= plan.stopPrice;
    const hitRunner = long ? b.high >= plan.runnerTpPrice : b.low <= plan.runnerTpPrice;
    const hitBase = long ? b.high >= plan.baseTpPrice : b.low <= plan.baseTpPrice;
    if (hitStop) return "loss"; // conservative: stop checked first
    if (hitRunner) return "runner";
    if (hitBase) return "base";
  }
  return "base"; // close at session end ~ treat as small base win (assumption)
}

// ---- One evaluation cycle --------------------------------------------------
async function runOnce() {
  const j = loadJournal();
  const broker = new PaperBroker(j.equity, "AUD");

  let today: Bar5m[], history: Bar5m[], macro: OvernightMacro;
  if (DEMO) {
    ({ today, history, macro } = demoData());
  } else {
    try {
      const all = await fetch5m("^AXJO");
      const latestDay = all.length ? all[all.length - 1].time.slice(0, 10) : "";
      today = all.filter((b) => b.time.slice(0, 10) === latestDay);
      history = all.filter((b) => b.time.slice(0, 10) !== latestDay);
      const [wallSt, aud, iron, nikkei] = await Promise.all([
        dailyPct("^GSPC"), dailyPct("AUDUSD=X"), dailyPct("BHP"), dailyPct("^N225"),
      ]);
      macro = { wallStPct: wallSt, audPct: aud, ironPct: iron, nikkeiPct: nikkei };
    } catch (e) {
      console.error(`✗ Data fetch failed (${e instanceof Error ? e.message : e}).`);
      console.error("  This sandbox blocks outbound network — run on a normal connection, or use --demo-data.");
      return;
    }
  }

  const sig = evaluateSignal(today, history, macro);
  console.log(`\n[${new Date().toISOString()}] mode=${broker.mode} equity=$${j.equity.toFixed(2)}`);
  console.log(`Signal: ${sig.reason} (stacked win-rate ${sig.prob}%)`);
  for (const f of sig.factors) console.log(`  ${f.ok ? "✓" : "·"} F${f.n} ${f.label}: ${f.detail}`);

  const check = preTradeCheck(j.state, DEFAULT_RISK);
  if (!sig.allGo || sig.direction === "none" || sig.entryPrice == null) {
    j.trades.push({ date: new Date().toISOString(), mode: broker.mode, direction: sig.direction, outcome: "no-trade", reason: sig.reason, equityAfter: j.equity });
    saveJournal(j);
    console.log("→ No trade.");
    return;
  }
  if (!check.ok) {
    console.log(`→ Signal was GO but BLOCKED by risk guardrail: ${check.reason}`);
    j.trades.push({ date: new Date().toISOString(), mode: broker.mode, direction: sig.direction, outcome: "no-trade", reason: `risk: ${check.reason}`, equityAfter: j.equity });
    saveJournal(j);
    return;
  }

  const plan = buildTradePlan(sig.direction, sig.entryPrice, j.state, DEFAULT_RISK);
  await broker.openPosition(plan);
  const entryIdx = today.findIndex((b) => b.close === sig.entryPrice);
  const outcome = resolvePaper(entryIdx, today, plan);
  j.state = applyOutcome(j.state, DEFAULT_RISK, outcome);
  j.equity = j.state.equity;
  broker.setEquity(j.equity);
  j.trades.push({ date: new Date().toISOString(), mode: broker.mode, direction: sig.direction, outcome, reason: sig.reason, equityAfter: j.equity });
  saveJournal(j);

  console.log(`→ ${broker.mode.toUpperCase()} ${sig.direction.toUpperCase()} @ ${sig.entryPrice} | outcome=${outcome} | equity now $${j.equity.toFixed(2)}`);
  if (j.state.halted) console.log(`⛔ Bot halted: ${j.state.haltReason}`);

  const settled = j.trades.filter((t) => t.outcome !== "no-trade");
  const wins = settled.filter((t) => t.outcome !== "loss").length;
  if (settled.length) console.log(`Journal: ${settled.length} trades, win rate ${((wins / settled.length) * 100).toFixed(1)}%`);
}

async function main() {
  if (LOOP && !DEMO) {
    console.log("Loop mode: evaluating every 5 minutes (Ctrl+C to stop). ASX hours only.");
    for (;;) {
      const hhmm = sydneyISO(Date.now() / 1000).slice(11);
      if (hhmm >= "10:00" && hhmm <= "16:00") await runOnce();
      else console.log(`[${hhmm} AEST] Outside ASX hours, sleeping.`);
      await new Promise((r) => setTimeout(r, 5 * 60_000));
    }
  } else {
    await runOnce();
  }
}

main();

export {};
