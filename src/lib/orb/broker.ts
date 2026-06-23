// Broker abstraction. The bot talks to this interface only, so paper and live
// are interchangeable — you prove the strategy on PaperBroker, then (only if it
// works) switch to a live adapter without touching the bot logic.

import type { TradePlan } from "@/lib/orb/risk";

export interface AccountInfo {
  equity: number;
  available?: number; // funds free for margin (can be < equity if positions are open)
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
    const available = acct?.balance?.available ?? balance;
    return { equity: balance, available, currency: acct?.currency ?? this.opts.currency ?? "AUD", mode: this.mode };
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

  // Search IG's market list — shows what's tradeable RIGHT NOW (marketStatus)
  // and whether each is an undated CFD ("DFB") or a dated "futures" contract.
  async searchMarkets(term: string): Promise<
    { epic: string; name: string; type: string; expiry: string; status: string }[]
  > {
    await this.login();
    const res = await fetch(`${this.base}/markets?searchTerm=${encodeURIComponent(term)}`, {
      headers: this.headers("1"),
    });
    if (!res.ok) throw new Error(`IG market search failed: ${res.status}`);
    const body: any = await res.json();
    return (body.markets ?? []).map((m: any) => ({
      epic: m.epic,
      name: m.instrumentName,
      type: m.instrumentType,
      expiry: m.expiry,
      status: m.marketStatus,
    }));
  }

  async openPosition(plan: TradePlan, availableFunds?: number): Promise<Position> {
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
    const marginFactorPct =
      market?.instrument?.marginDepositBands?.[0]?.margin ??
      (typeof market?.instrument?.marginFactor === "number" ? market.instrument.marginFactor : null);

    // 2. Size = notional / price, snapped to the broker minimum.
    const rawSize = plan.notional / price;
    let size = Math.max(minSize, Math.round(rawSize / minSize) * minSize);

    // 3a. Cap size so required margin fits AVAILABLE funds (prevents IG
    //     INSUFFICIENT_FUNDS). 95% buffer. If even the minimum won't fit, say so.
    const marginFor = (s: number) =>
      marginFactorPct != null ? s * price * (marginFactorPct / 100) : null;
    if (marginFactorPct != null && availableFunds != null && availableFunds > 0) {
      if ((marginFor(size) as number) > availableFunds * 0.95) {
        const fit = Math.floor((availableFunds * 0.95) / (price * (marginFactorPct / 100)) / minSize) * minSize;
        if (fit < minSize) {
          throw new Error(
            `Insufficient margin: one minimum position (${minSize}) needs ≈ $${(marginFor(minSize) as number).toFixed(0)} ` +
              `but only $${availableFunds.toFixed(0)} is available on the account the API is using. ` +
              `Check Connect shows the right balance, add demo funds, or pick a smaller-denomination market.`,
          );
        }
        size = fit;
      }
    }

    // 3b. SAFETY: refuse if the snapped size over-risks vs intent.
    const realMaxLoss = size * price * this.optsStopFrac(plan);
    if (realMaxLoss > plan.maxLossDollar * 1.5) {
      throw new Error(
        `Refusing order: min deal size (${minSize}) forces size ${size}, whose worst-case loss ` +
          `≈ $${realMaxLoss.toFixed(2)} vs your intended $${plan.maxLossDollar.toFixed(2)}. ` +
          `Your account is too small to trade this instrument at this risk. Lower leverage/size or pick a smaller-denomination market.`,
      );
    }
    const reqMargin = marginFor(size);

    const order: Record<string, unknown> = {
      epic: this.opts.epic,
      expiry: "-",
      direction: plan.direction === "long" ? "BUY" : "SELL",
      size,
      orderType: "MARKET",
      guaranteedStop: false,
      forceOpen: true,
      currencyCode: this.opts.currency ?? "AUD",
      stopLevel: round(plan.stopPrice), // protective stop always attached
    };
    // Fixed take-profit only for bracket strategies; flip-exit strategies (HA)
    // omit it so the trend can run, and are closed actively by the caller.
    if (plan.useLimit) order.limitLevel = round(plan.baseTpPrice);

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
    if (!ores.ok) throw new Error(`IG order rejected (size ${size}): ${ores.status} ${await ores.text()}`);
    const { dealReference } = (await ores.json()) as any;
    const cres = await fetch(`${this.base}/confirms/${dealReference}`, { headers: this.headers("1") });
    const confirm: any = await cres.json();
    if (confirm?.dealStatus !== "ACCEPTED") {
      const m = reqMargin != null ? `, est. margin $${reqMargin.toFixed(0)}` : "";
      throw new Error(`IG deal not accepted: ${confirm?.reason ?? "unknown"} (size ${size}${m})`);
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
  // Open positions (optionally filtered to one epic) — used for flip-exit
  // management. Direction is normalised to long/short.
  async getOpenPositions(
    epic?: string,
  ): Promise<{ dealId: string; direction: "long" | "short"; size: number; epic: string; level: number }[]> {
    await this.login();
    const res = await fetch(`${this.base}/positions`, { headers: this.headers("2") });
    if (!res.ok) throw new Error(`IG /positions failed: ${res.status}`);
    const body: any = await res.json();
    return (body.positions ?? [])
      .map((p: any) => ({
        dealId: p.position?.dealId,
        direction: p.position?.direction === "BUY" ? "long" : "short",
        size: p.position?.size ?? p.position?.dealSize ?? 0,
        epic: p.market?.epic,
        level: p.position?.level ?? 0,
      }))
      .filter((p: any) => (epic ? p.epic === epic : true));
  }

  // Close an open position at market (opposite-direction deal). Honours dry-run.
  async closePosition(pos: { dealId: string; direction: "long" | "short"; size: number }): Promise<string> {
    await this.login();
    const body = {
      dealId: pos.dealId,
      direction: pos.direction === "long" ? "SELL" : "BUY",
      size: pos.size,
      orderType: "MARKET",
    };
    if (this.dryRun) {
      console.log(`[IG ${this.mode} DRY-RUN] Would CLOSE position ${pos.dealId}`);
      return "dryrun-close";
    }
    const res = await fetch(`${this.base}/positions/otc`, {
      method: "POST",
      headers: { ...this.headers("1"), _method: "DELETE" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`IG close failed: ${res.status} ${await res.text()}`);
    const { dealReference } = (await res.json()) as any;
    return dealReference ?? "closed";
  }

  closeInfo() {
    return "stop is broker-side; profit exit is active (HA flip-exit) or the attached limit (bracket). Verify on demo.";
  }
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}

