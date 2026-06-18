// Broker abstraction. The bot talks to this interface only, so paper and live
// are interchangeable — you prove the strategy on PaperBroker, then (only if it
// works) switch to a live adapter without touching the bot logic.

import type { TradePlan } from "@/lib/orb/risk";

export interface AccountInfo {
  equity: number;
  currency: string;
  mode: "paper" | "live";
}

export interface Position {
  id: string;
  direction: "long" | "short";
  entryPrice: number;
  stopPrice: number;
  baseTpPrice: number;
  runnerTpPrice: number;
}

export interface Broker {
  mode: "paper" | "live";
  getAccount(): Promise<AccountInfo>;
  openPosition(plan: TradePlan): Promise<Position>;
  // Resolve a position against a price path; returns the outcome bucket.
  // (Paper resolves synthetically; live brokers attach OCO stop/limit orders.)
  closeInfo(): string;
}

// ---------------------------------------------------------------------------
// PaperBroker — virtual money. This is the DEFAULT and the only one safe to run
// unattended while you're still measuring your real win rate.
// ---------------------------------------------------------------------------
export class PaperBroker implements Broker {
  mode = "paper" as const;
  private equity: number;
  private seq = 0;
  constructor(startingEquity: number, private currency = "AUD") {
    this.equity = startingEquity;
  }
  async getAccount(): Promise<AccountInfo> {
    return { equity: this.equity, currency: this.currency, mode: "paper" };
  }
  async openPosition(plan: TradePlan): Promise<Position> {
    return {
      id: `paper-${++this.seq}`,
      direction: plan.direction,
      entryPrice: plan.entryPrice,
      stopPrice: plan.stopPrice,
      baseTpPrice: plan.baseTpPrice,
      runnerTpPrice: plan.runnerTpPrice,
    };
  }
  setEquity(e: number) {
    this.equity = e;
  }
  closeInfo() {
    return "paper fills are simulated at the modelled stop/TP levels";
  }
}

// ---------------------------------------------------------------------------
// IGBroker — LIVE / DEMO adapter skeleton for IG Markets (popular in AU, has a
// REST API and a free demo). It defaults to the DEMO endpoint. Going live
// requires an explicit, scary env confirmation. It is intentionally minimal:
// you MUST verify order placement on the DEMO account yourself before trusting
// it — this code has not been run against a live exchange here.
// ---------------------------------------------------------------------------
export class IGBroker implements Broker {
  mode: "paper" | "live";
  private base: string;
  constructor(
    private opts: {
      apiKey: string;
      username: string;
      password: string;
      live: boolean;
      epic: string; // IG instrument id for AUS200, e.g. "IX.D.ASX.IFD.IP"
    },
  ) {
    const confirmed = process.env.LIVE_TRADING_CONFIRMED === "I_UNDERSTAND_I_CAN_LOSE_EVERYTHING";
    if (opts.live && !confirmed) {
      throw new Error(
        "Refusing to start a LIVE broker without informed consent.\n" +
          "Set env LIVE_TRADING_CONFIRMED=I_UNDERSTAND_I_CAN_LOSE_EVERYTHING to proceed,\n" +
          "and only after the strategy has shown a real positive edge on the demo account.",
      );
    }
    this.mode = opts.live ? "live" : "paper";
    this.base = opts.live ? "https://api.ig.com/gateway/deal" : "https://demo-api.ig.com/gateway/deal";
  }
  async getAccount(): Promise<AccountInfo> {
    // Real implementation: POST /session (v3) to get tokens, GET /accounts.
    throw new Error(
      "IGBroker.getAccount() is a documented stub. Implement the /session login + " +
        "/accounts call against " + this.base + " and TEST IT ON DEMO before going live.",
    );
  }
  async openPosition(): Promise<Position> {
    // Real implementation: POST /positions/otc with the epic, direction, size,
    // and attached stopLevel + limitLevel (OCO) from the TradePlan.
    throw new Error("IGBroker.openPosition() is a documented stub — implement + demo-test first.");
  }
  closeInfo() {
    return "live exits via broker-side OCO stop/limit orders (must be verified on demo)";
  }
}
