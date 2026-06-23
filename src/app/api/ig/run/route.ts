import { IGBroker } from "@/lib/orb/broker";
import { assembleLiveSession, fetchIntraday } from "@/lib/orb/data";
import { evaluateSignal } from "@/lib/orb/signal";
import { evaluateHeikinAshi } from "@/lib/strategies/heikinashi";
import { DEFAULT_RISK, preTradeCheck, buildTradePlan, type RiskState } from "@/lib/orb/risk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIVE_PHRASE = "I_UNDERSTAND_I_CAN_LOSE_EVERYTHING";

// POST /api/ig/run — one evaluation cycle: fetch data, compute the 5-factor
// signal, and (if GO + checks pass) open a position via IG. DEMO unless the
// caller explicitly opts into live + sends the confirmation phrase. Credentials
// are used for this request only and never persisted.
export async function POST(request: Request) {
  try {
    const b = await request.json();
    const live = !!b.live;
    const sendRealOrders = !!b.sendRealOrders;
    const liveConfirmed = b.confirmPhrase === LIVE_PHRASE;

    // Risk state can be carried by the client between calls (supervised mode).
    const state: RiskState = {
      equity: 0,
      consecutiveLosses: b.consecutiveLosses ?? 0,
      realisedTodayPct: b.realisedTodayPct ?? 0,
      openTrades: b.openTrades ?? 0,
      halted: false,
    };

    let broker: IGBroker;
    try {
      broker = new IGBroker({
        apiKey: b.apiKey,
        username: b.username,
        password: b.password,
        live,
        epic: b.epic || "IX.D.ASX.IFD.IP",
        currency: b.currency || "AUD",
        liveConfirmed,
        placeRealOrders: sendRealOrders,
      });
    } catch (e) {
      return Response.json({ ok: false, error: e instanceof Error ? e.message : "broker init failed" }, { status: 400 });
    }

    const account = await broker.getAccount();
    // Capital to deploy: how much of the account the bot sizes from. Blank/0 =
    // full balance; otherwise capped at the real balance (can't deploy more
    // than you have).
    const capital = Number(b.capital) > 0 ? Math.min(Number(b.capital), account.equity) : account.equity;
    state.equity = capital;

    const strategy = b.strategy === "heikinashi" ? "heikinashi" : "orb";
    const timeframe = ["5m", "15m", "30m", "60m"].includes(b.timeframe) ? b.timeframe : "5m";
    let sig;
    if (strategy === "heikinashi") {
      // Decoupled from the ASX: Heikin Ashi runs on any market's series at the
      // chosen timeframe. Default ^AXJO; pass dataSymbol (e.g. ES=F, NQ=F, GC=F)
      // to run a ~24/5 futures market right now. (FX has no Yahoo volume, so the
      // volume oscillator won't fire — stick to index/commodity futures.)
      const bars = await fetchIntraday(b.dataSymbol || "^AXJO", timeframe);
      sig = evaluateHeikinAshi(bars.slice(-300));
    } else {
      // ORB is ASX-specific (built around the 10:00 AEST open).
      const session = await assembleLiveSession();
      sig = evaluateSignal(session.today, session.history, session.macro);
    }

    const cfg = { ...DEFAULT_RISK, riskFractionOfEquity: b.riskFraction ?? DEFAULT_RISK.riskFractionOfEquity };
    const epic = b.epic || "IX.D.ASX.IFD.IP";
    const flipExit = strategy === "heikinashi"; // HA rides the trend, exits on the reverse flip

    let action = "no-trade";
    let detail = sig.reason;
    let order = null;
    const exits: string[] = [];

    // 1. FLIP-EXIT: when actually managing real positions, close any open
    //    position whose direction is now against the current HA trend.
    if (flipExit && sendRealOrders && sig.trend && sig.trend !== "none") {
      try {
        const open = await broker.getOpenPositions(epic);
        for (const p of open) {
          const against = (p.direction === "long" && sig.trend === "down") || (p.direction === "short" && sig.trend === "up");
          if (against) {
            await broker.closePosition(p);
            exits.push(`closed ${p.direction} ${p.dealId} on HA flip to ${sig.trend}`);
          }
        }
        // reflect remaining open positions in the risk guardrail
        state.openTrades = (await broker.getOpenPositions(epic)).filter(
          (p) => !((p.direction === "long" && sig.trend === "down") || (p.direction === "short" && sig.trend === "up")),
        ).length;
      } catch (e) {
        exits.push(`exit-check failed: ${e instanceof Error ? e.message : e}`);
      }
    }
    if (exits.length) { action = "flip-exit"; detail = exits.join("; "); }

    const check = preTradeCheck(state, cfg);

    // 2. ENTRY: open on a fresh signal if flat. HA uses a stop only (no fixed
    //    take-profit) so the flip-exit can let winners run.
    if (sig.allGo && sig.direction !== "none" && sig.entryPrice != null) {
      if (!check.ok) {
        action = exits.length ? action : "blocked";
        detail = exits.length ? `${detail}; entry blocked: ${check.reason}` : `Signal GO but blocked: ${check.reason}`;
      } else {
        const plan = buildTradePlan(sig.direction, sig.entryPrice, state, cfg, !flipExit);
        try {
          // Size to the lesser of deployed capital and the account's free funds.
          const fundsCap = Math.min(capital, account.available ?? account.equity);
          const pos = await broker.openPosition(plan, fundsCap);
          action = broker.mode === "live" && sendRealOrders ? "live-order" : sendRealOrders ? "demo-order" : "dry-run";
          detail = `${exits.length ? detail + "; " : ""}${action}: ${sig.direction.toUpperCase()} @ ${sig.entryPrice} (id ${pos.id})${flipExit ? " [stop only, flip-exit]" : ""}`;
          order = { ...plan, id: pos.id };
        } catch (e) {
          action = "order-error";
          detail = e instanceof Error ? e.message : "order failed";
        }
      }
    }

    return Response.json({
      ok: true,
      mode: broker.mode,
      strategy,
      timeframe: strategy === "heikinashi" ? timeframe : "5m",
      dataSymbol: strategy === "heikinashi" ? b.dataSymbol || "^AXJO" : undefined,
      account,
      capitalDeployed: capital,
      signal: sig,
      action,
      detail,
      order,
    });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "run failed" }, { status: 500 });
  }
}
