// Position sizing + hard risk guardrails for the ORB bot.
//
// These guardrails are the difference between "automated discipline" and
// "automated ruin". They CANNOT be disabled from a config flag without editing
// this file on purpose — that friction is intentional.

export interface RiskConfig {
  leverage: number; // e.g. 20 (ASIC retail cap for index CFDs)
  stopMovePct: number; // ASX200 % move that triggers the stop (e.g. 1.0)
  baseTpMovePct: number; // base take-profit % move (e.g. 0.735)
  runnerTpMovePct: number; // runner take-profit % move (e.g. 3.0)
  riskFractionOfEquity: number; // fraction of equity to put at risk per trade (1 = full compounding)
  // --- circuit breakers ---
  maxConsecutiveLosses: number; // halt after this many losses in a row
  maxDailyLossPct: number; // halt for the day after losing this % of equity
  maxOpenTrades: number; // never exceed this many concurrent positions
}

// Sane DEFAULTS are deliberately LESS aggressive than the $100->$1m spec,
// because the backtest showed full-compounding 20x is ruinous off a true edge.
export const DEFAULT_RISK: RiskConfig = {
  leverage: 20,
  stopMovePct: 1.0,
  baseTpMovePct: 0.735,
  runnerTpMovePct: 3.0,
  riskFractionOfEquity: 0.25, // risk 1/4 of the account per trade, NOT all of it
  maxConsecutiveLosses: 3,
  maxDailyLossPct: 20,
  maxOpenTrades: 1,
};

export interface RiskState {
  equity: number;
  consecutiveLosses: number;
  realisedTodayPct: number; // cumulative % of equity lost/gained today
  openTrades: number;
  halted: boolean;
  haltReason?: string;
}

export interface TradePlan {
  direction: "long" | "short";
  entryPrice: number;
  stopPrice: number;
  baseTpPrice: number;
  runnerTpPrice: number;
  notional: number; // dollar exposure (equity-at-risk * leverage-ish)
  marginUsed: number; // cash the position ties up
  maxLossDollar: number; // expected loss if stopped
  useLimit: boolean; // attach a fixed take-profit? (false = let it run, e.g. HA flip-exit)
}

export function preTradeCheck(state: RiskState, cfg: RiskConfig): { ok: boolean; reason: string } {
  if (state.halted) return { ok: false, reason: state.haltReason ?? "halted" };
  if (state.openTrades >= cfg.maxOpenTrades) return { ok: false, reason: "max open trades reached" };
  if (state.consecutiveLosses >= cfg.maxConsecutiveLosses)
    return { ok: false, reason: `circuit breaker: ${state.consecutiveLosses} losses in a row` };
  if (state.realisedTodayPct <= -cfg.maxDailyLossPct)
    return { ok: false, reason: `circuit breaker: daily loss limit (${cfg.maxDailyLossPct}%) hit` };
  if (state.equity <= 0) return { ok: false, reason: "account depleted" };
  return { ok: true, reason: "" };
}

export function buildTradePlan(
  direction: "long" | "short",
  entryPrice: number,
  state: RiskState,
  cfg: RiskConfig,
  useLimit = true,
): TradePlan {
  const dirMul = direction === "long" ? 1 : -1;
  const stopPrice = entryPrice * (1 - dirMul * (cfg.stopMovePct / 100));
  const baseTpPrice = entryPrice * (1 + dirMul * (cfg.baseTpMovePct / 100));
  const runnerTpPrice = entryPrice * (1 + dirMul * (cfg.runnerTpMovePct / 100));

  // Capital we're willing to lose this trade, and the leveraged exposure that
  // implies given a stopMovePct stop.
  const capitalAtRisk = state.equity * cfg.riskFractionOfEquity;
  const maxLossDollar = capitalAtRisk * (cfg.leverage * cfg.stopMovePct) / 100;
  const notional = capitalAtRisk * cfg.leverage;
  const marginUsed = notional / cfg.leverage;

  return { direction, entryPrice, stopPrice, baseTpPrice, runnerTpPrice, notional, marginUsed, maxLossDollar, useLimit };
}

// Apply a settled trade outcome to the risk state.
export function applyOutcome(
  state: RiskState,
  cfg: RiskConfig,
  outcome: "base" | "runner" | "loss",
): RiskState {
  const grossPct =
    outcome === "loss"
      ? -cfg.leverage * cfg.stopMovePct
      : outcome === "runner"
        ? cfg.leverage * cfg.runnerTpMovePct
        : cfg.leverage * cfg.baseTpMovePct;
  // scale by how much of the account was actually deployed
  const accountPct = grossPct * cfg.riskFractionOfEquity;
  const newEquity = state.equity * (1 + accountPct / 100);
  const consecutiveLosses = outcome === "loss" ? state.consecutiveLosses + 1 : 0;
  const realisedTodayPct = state.realisedTodayPct + accountPct;

  let halted = false;
  let haltReason: string | undefined;
  if (consecutiveLosses >= cfg.maxConsecutiveLosses) {
    halted = true;
    haltReason = `circuit breaker: ${consecutiveLosses} losses in a row`;
  } else if (realisedTodayPct <= -cfg.maxDailyLossPct) {
    halted = true;
    haltReason = `circuit breaker: daily loss limit (${cfg.maxDailyLossPct}%) hit`;
  }
  return { ...state, equity: newEquity, consecutiveLosses, realisedTodayPct, halted, haltReason };
}
