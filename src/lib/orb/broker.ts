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
// IGBroker — LIVE / DEMO adapter for IG Markets (popular in AU, real REST API,
// free demo on the SAME API). Defaults to the DEMO endpoint (virtual money).
//
// SAFETY MODEL — read before trusting this with money:
//  - This code has NOT been run against IG's servers here (no creds, sandboxed
//    network). You MUST verify it end-to-end on the DEMO account first.
//  - Live mode requires env LIVE_TRADING_CONFIRMED=I_UNDERSTAND_I_CAN_LOSE_EVERYTHING.
//  - Even once live, orders are DRY-RUN (logged, not sent) until you also set
//    ORB_PLACE_REAL_ORDERS=yes. Two separate switches on purpose.
//  - Before sending, it refuses any order whose worst-case loss exceeds the
//    plan's intended max loss by >50% (e.g. because IG's min deal size forced a
//    bigger position than $500 can safely carry).
// ---------------------------------------------------------------------------
interface IGOpts {
  apiKey: string;
  username: string;
  password: string;
  live: boolean;
  epic: string; // IG instrument id for AUS200, e.g. "IX.D.ASX.IFD.IP" (verify in your account)
  currency?: string;
  // Consent can be supplied explicitly (e.g. from a UI) or via env (CLI).
  liveConfirmed?: boolean;
  placeRealOrders?: boolean;
}

export class IGBroker implements Broker {
  mode: "paper" | "live";
  private base: string;
  private cst = "";
  private xst = "";
  private accountId = "";
  private dryRun: boolean;

  constructor(private opts: IGOpts) {
    const confirmed =
      opts.liveConfirmed ?? process.env.LIVE_TRADING_CONFIRMED === "I_UNDERSTAND_I_CAN_LOSE_EVERYTHING";
    if (opts.live && !confirmed) {
      throw new Error(
        "Live trading not confirmed. Real money requires explicit confirmation " +
          "(type the confirmation phrase in the app, or set LIVE_TRADING_CONFIRMED), " +
          "and only after the strategy has shown a real positive edge on the demo account.",
      );
    }
    this.mode = opts.live ? "live" : "paper";
    this.base = opts.live ? "https://api.ig.com/gateway/deal" : "https://demo-api.ig.com/gateway/deal";
    // Orders are dry-run unless explicitly armed, even on a confirmed live account.
    this.dryRun = !(opts.placeRealOrders ?? process.env.ORB_PLACE_REAL_ORDERS === "yes");
  }

  private headers(version = "1"): Record<string, string> {
    const h: Record<string, string> = {
      "X-IG-API-KEY": this.opts.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json; charset=UTF-8",
      Version: version,
    };
    if (this.cst) h["CST"] = this.cst;
    if (this.xst) h["X-SECURITY-TOKEN"] = this.xst;
    return h;
  }

  private async login(): Promise<void> {
    if (this.cst && this.xst) return;
    const res = await fetch(`${this.base}/session`, {
      method: "POST",
      headers: this.headers("2"),
      body: JSON.stringify({ identifier: this.opts.username, password: this.opts.password }),
    });
    if (!res.ok) throw new Error(`IG login failed: ${res.status} ${await res.text()}`);
    this.cst = res.headers.get("CST") ?? "";
    this.xst = res.headers.get("X-SECURITY-TOKEN") ?? "";
    if (!this.cst || !this.xst) throw new Error("IG login returned no session tokens");
    const body: any = await res.json();
    this.accountId = body?.currentAccountId ?? "";
  }

  async getAccount(): Promise<AccountInfo> {
    await this.login();
    const res = await fetch(`${this.base}/accounts`, { headers: this.headers("1") });
    if (!res.ok) throw new Error(`IG /accounts failed: ${res.status}`);
    const body: any = await res.json();
    const acct =
      (body.accounts ?? []).find((a: any) => a.accountId === this.accountId) ??
      (body.accounts ?? []).find((a: any) => a.preferred) ??
      body.accounts?.[0];
    const balance = acct?.balance?.balance ?? 0;
    return { equity: balance, currency: acct?.currency ?? this.opts.currency ?? "AUD", mode: this.mode };
  }

  // Read the instrument's dealing rules so you can see — from IG's own data —
  // whether your account is even big enough to trade it at sane risk.
  async marketInfo(): Promise<{
    name: string;
    price: number;
    minDealSize: number;
    marginFactorPct: number | null;
    minExposure: number;
    minMargin: number | null;
    minStopRiskAt1pct: number;
  }> {
    await this.login();
    const res = await fetch(`${this.base}/markets/${encodeURIComponent(this.opts.epic)}`, {
      headers: this.headers("3"),
    });
    if (!res.ok) throw new Error(`IG /markets failed: ${res.status}`);
    const m: any = await res.json();
    const price = m?.snapshot?.offer ?? 0;
    const minDealSize = m?.dealingRules?.minDealSize?.value ?? 1;
    const marginFactorPct =
      m?.instrument?.marginDepositBands?.[0]?.margin ??
      (typeof m?.instrument?.marginFactor === "number" ? m.instrument.marginFactor : null);
    const minExposure = minDealSize * price;
    return {
      name: m?.instrument?.name ?? this.opts.epic,
      price,
      minDealSize,
      marginFactorPct,
      minExposure,
      minMargin: marginFactorPct != null ? minExposure * (marginFactorPct / 100) : null,
      minStopRiskAt1pct: minExposure * 0.01,
    };
  }

  async openPosition(plan: TradePlan): Promise<Position> {
    await this.login();

    // 1. Pull dealing rules + a live snapshot so we size correctly.
    const mres = await fetch(`${this.base}/markets/${encodeURIComponent(this.opts.epic)}`, {
      headers: this.headers("3"),
    });
    if (!mres.ok) throw new Error(`IG /markets failed: ${mres.status}`);
    const market: any = await mres.json();
    const minSize = market?.dealingRules?.minDealSize?.value ?? 1;
    const offer = market?.snapshot?.offer ?? plan.entryPrice;
    const bid = market?.snapshot?.bid ?? plan.entryPrice;
    const price = plan.direction === "long" ? offer : bid;

    // 2. Size = notional / price, snapped UP to the broker minimum.
    const rawSize = plan.notional / price;
    const size = Math.max(minSize, Math.round(rawSize / minSize) * minSize);

    // 3. SAFETY: if the snapped size makes the real worst-case loss much bigger
    //    than intended, refuse. ($500 often can't meet index min deal sizes
    //    without over-risking — this is the guard that catches that.)
    const realMaxLoss = size * price * (this.optsStopFrac(plan));
    if (realMaxLoss > plan.maxLossDollar * 1.5) {
      throw new Error(
        `Refusing order: min deal size (${minSize}) forces size ${size}, whose worst-case loss ` +
          `≈ $${realMaxLoss.toFixed(2)} vs your intended $${plan.maxLossDollar.toFixed(2)}. ` +
          `Your account is too small to trade this instrument at this risk. Lower leverage/size or pick a smaller-denomination market.`,
      );
    }

    const order = {
      epic: this.opts.epic,
      expiry: "-",
      direction: plan.direction === "long" ? "BUY" : "SELL",
      size,
      orderType: "MARKET",
      guaranteedStop: false,
      forceOpen: true,
      currencyCode: this.opts.currency ?? "AUD",
      stopLevel: round(plan.stopPrice),
      limitLevel: round(plan.baseTpPrice),
    };

    if (this.dryRun) {
      console.log(`[IG ${this.mode} DRY-RUN] Would place order:`, JSON.stringify(order));
      console.log("  Set ORB_PLACE_REAL_ORDERS=yes to actually send. (Verify on DEMO first.)");
      return this.posFrom("dryrun", plan);
    }

    // 4. Place + confirm.
    const ores = await fetch(`${this.base}/positions/otc`, {
      method: "POST",
      headers: this.headers("2"),
      body: JSON.stringify(order),
    });
    if (!ores.ok) throw new Error(`IG order rejected: ${ores.status} ${await ores.text()}`);
    const { dealReference } = (await ores.json()) as any;
    const cres = await fetch(`${this.base}/confirms/${dealReference}`, { headers: this.headers("1") });
    const confirm: any = await cres.json();
    if (confirm?.dealStatus !== "ACCEPTED") {
      throw new Error(`IG deal not accepted: ${confirm?.reason ?? "unknown"}`);
    }
    return this.posFrom(confirm?.affectedDeals?.[0]?.dealId ?? dealReference, plan);
  }

  private optsStopFrac(plan: TradePlan): number {
    return Math.abs(plan.entryPrice - plan.stopPrice) / plan.entryPrice;
  }
  private posFrom(id: string, plan: TradePlan): Position {
    return {
      id,
      direction: plan.direction,
      entryPrice: plan.entryPrice,
      stopPrice: plan.stopPrice,
      baseTpPrice: plan.baseTpPrice,
      runnerTpPrice: plan.runnerTpPrice,
    };
  }
  closeInfo() {
    return "live exits run broker-side via the attached OCO stop + limit (verify on demo). Runner scale-out is not yet automated.";
  }
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}

