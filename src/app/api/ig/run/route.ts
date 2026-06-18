import { IGBroker } from "@/lib/orb/broker";
import { assembleLiveSession, fetch5m } from "@/lib/orb/data";
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
    let sig;
    if (strategy === "heikinashi") {
      // Decoupled from the ASX: Heikin Ashi runs on any market's 5-min series.
      // Default ^AXJO; pass dataSymbol (e.g. ES=F, NQ=F, GC=F) to run a ~24/5
      // futures market right now. (FX has no Yahoo volume, so the volume
      // oscillator won't fire — stick to index/commodity futures.)
      const bars = await fetch5m(b.dataSymbol || "^AXJO");
      sig = evaluateHeikinAshi(bars.slice(-300));
    } else {
      // ORB is ASX-specific (built around the 10:00 AEST open).
      const session = await assembleLiveSession();
      sig = evaluateSignal(session.today, session.history, session.macro);
    }

    const cfg = { ...DEFAULT_RISK, riskFractionOfEquity: b.riskFraction ?? DEFAULT_RISK.riskFractionOfEquity };
    const check = preTradeCheck(state, cfg);

    let action = "no-trade";
    let detail = sig.reason;
    let order = null;

    if (sig.allGo && sig.direction !== "none" && sig.entryPrice != null) {
      if (!check.ok) {
        action = "blocked";
        detail = `Signal GO but blocked by risk guardrail: ${check.reason}`;
      } else {
        const plan = buildTradePlan(sig.direction, sig.entryPrice, state, cfg);
        try {
          const pos = await broker.openPosition(plan);
          action = broker.mode === "live" && sendRealOrders ? "live-order" : sendRealOrders ? "demo-order" : "dry-run";
          detail = `${action}: ${sig.direction.toUpperCase()} @ ${sig.entryPrice} (id ${pos.id})`;
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
