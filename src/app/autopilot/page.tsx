"use client";

import { useEffect, useRef, useState } from "react";

const LIVE_PHRASE = "I_UNDERSTAND_I_CAN_LOSE_EVERYTHING";

type LogRow = { t: string; mode: string; prob: number; action: string; detail: string };

export default function AutopilotPage() {
  // ---- connection ----
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [epic, setEpic] = useState("IX.D.ASX.IFD.IP");
  const [live, setLive] = useState(false);
  const [strategy, setStrategy] = useState<"orb" | "heikinashi">("orb");
  const [dataSymbol, setDataSymbol] = useState("ES=F");
  const [timeframe, setTimeframe] = useState<"5m" | "15m" | "30m" | "60m">("30m");
  const [capital, setCapital] = useState("");

  // ---- arming / consent ----
  const [sendRealOrders, setSendRealOrders] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");

  // ---- state ----
  const [account, setAccount] = useState<any>(null);
  const [market, setMarket] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [log, setLog] = useState<LogRow[]>([]);
  const [auto, setAuto] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const liveArmed = live && sendRealOrders;
  const liveReady = !liveArmed || confirmPhrase === LIVE_PHRASE;
  const creds = { apiKey, username, password, epic, live };

  async function connect() {
    setBusy(true); setError(""); setAccount(null); setMarket(null);
    try {
      const res = await fetch("/api/ig/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(creds) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setAccount(data.account); setMarket(data.market);
    } catch (e) { setError(e instanceof Error ? e.message : "connect failed"); }
    finally { setBusy(false); }
  }

  async function runOnce() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ig/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...creds, strategy, dataSymbol, timeframe, capital: capital ? Number(capital) : 0, sendRealOrders, confirmPhrase }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      if (data.account) setAccount(data.account);
      setLog((l) => [
        { t: new Date().toLocaleTimeString(), mode: data.mode, prob: data.signal?.prob ?? 0, action: data.action, detail: data.detail },
        ...l,
      ].slice(0, 50));
    } catch (e) { setError(e instanceof Error ? e.message : "run failed"); }
    finally { setBusy(false); }
  }

  // Poll once per bar: ORB on 5-min, Heikin Ashi on its selected timeframe.
  // (Polling faster than the bar would just re-fire the same flip.)
  const pollMin = strategy === "orb" ? 5 : { "5m": 5, "15m": 15, "30m": 30, "60m": 60 }[timeframe];
  function toggleAuto() {
    if (auto) { if (timer.current) clearInterval(timer.current); timer.current = null; setAuto(false); }
    else { runOnce(); timer.current = setInterval(runOnce, pollMin * 60_000); setAuto(true); }
  }
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const canRun = !!apiKey && !!username && !!password && liveReady && !busy;
  const field = "w-full px-3 py-2 rounded-lg panel-2 border border-[var(--color-border)] mono text-sm focus:outline-none focus:border-[var(--color-accent)]";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <section className="panel p-6 sm:p-8">
        <div className="text-xs font-medium tracking-widest text-[var(--bs-gold)] uppercase mb-2">Bill Street · Autopilot</div>
        <h1 className="text-3xl font-bold tracking-tight">IG Auto-Trader</h1>
        <p className="text-[var(--color-muted)] mt-2">
          Enter your IG API details, connect, and run the 5-factor ORB bot against your account.
          <strong className="text-[var(--color-text)]"> Defaults to Demo (virtual money).</strong>
        </p>
        <div className="mt-4 rounded-xl border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 p-4 text-sm text-[var(--color-muted)] leading-relaxed">
          ⚠ <strong className="text-[var(--color-text)]">Before you use Live:</strong> the order code has not been
          verified against IG&apos;s servers — prove it on Demo first. Run this <strong className="text-[var(--color-text)]">locally</strong>
          (never paste live broker credentials into a hosted site). Credentials are used per-request and never stored.
          Auto-run only works while this tab is open — true 24/7 needs the CLI bot (see AUTOMATION.md).
        </div>
      </section>

      {/* CONNECTION */}
      <section className="panel p-6 space-y-4">
        <h2 className="text-lg font-semibold">1 · Connect</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-[var(--color-muted)]">IG API key
            <input className={field} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="api key" />
          </label>
          <label className="text-xs text-[var(--color-muted)]">Username
            <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          </label>
          <label className="text-xs text-[var(--color-muted)]">Password
            <input type="password" className={field} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" />
          </label>
          <label className="text-xs text-[var(--color-muted)]">AUS200 epic
            <input className={field} value={epic} onChange={(e) => setEpic(e.target.value)} />
          </label>
        </div>
        <div className="flex items-center gap-2">
          {(["demo", "live"] as const).map((opt) => (
            <button key={opt} onClick={() => setLive(opt === "live")}
              className={`px-4 py-1.5 rounded-lg text-sm border transition ${
                (opt === "live") === live
                  ? opt === "live" ? "bg-[var(--color-down)] border-[var(--color-down)] text-white" : "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                  : "panel-2 border-[var(--color-border)] text-[var(--color-muted)]"}`}>
              {opt === "live" ? "● Live (real money)" : "Demo (virtual)"}
            </button>
          ))}
          <button onClick={connect} disabled={busy || !apiKey || !username || !password}
            className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-white disabled:opacity-40">
            {busy ? "…" : "Connect"}
          </button>
        </div>

        {account && (
          <div className="panel-2 p-4 text-sm space-y-2">
            <div>✓ Connected · <span className="mono">{account.equity} {account.currency}</span> · mode <strong>{account.mode}</strong></div>
            {market && (
              <div className="text-xs text-[var(--color-muted)] leading-relaxed">
                {market.name} @ {market.price} · min deal size {market.minDealSize} → min exposure ≈ ${Math.round(market.minExposure)}
                {market.minMargin != null && <> · margin to open ≈ ${Math.round(market.minMargin)}</>} ·
                a 1% stop risks ≈ ${Math.round(market.minStopRiskAt1pct)}.
                {market.minMargin != null && account.equity < market.minMargin && (
                  <strong className="text-[var(--color-down)]"> Your balance is below the margin for one minimum trade — too small to trade this sanely.</strong>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ARM + RUN */}
      <section className="panel p-6 space-y-4">
        <h2 className="text-lg font-semibold">2 · Arm &amp; run</h2>
        <div>
          <div className="text-xs text-[var(--color-muted)] mb-1.5">Strategy</div>
          <div className="flex flex-wrap gap-1.5">
            {([
              { v: "orb", label: "ASX200 ORB (5-factor)" },
              { v: "heikinashi", label: "Heikin Ashi + Volume Osc." },
            ] as const).map((s) => (
              <button key={s.v} onClick={() => setStrategy(s.v)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                  strategy === s.v ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white" : "panel-2 border-[var(--color-border)] text-[var(--color-muted)]"}`}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--color-muted)] mt-1.5">
            {strategy === "orb"
              ? "Opening-range breakout, one setup/day around 10:30 AEST. ASX 200 only."
              : "Enters on a Heikin-Ashi trend flip confirmed by an expanding volume oscillator. Runs on any market — pick one below to trade right now."}
          </p>
        </div>

        {strategy === "heikinashi" && (
          <div>
            <div className="text-xs text-[var(--color-muted)] mb-1.5">Market (data feed)</div>
            <div className="flex flex-wrap gap-1.5">
              {([
                { v: "ES=F", label: "S&P 500" },
                { v: "NQ=F", label: "Nasdaq 100" },
                { v: "YM=F", label: "Dow 30" },
                { v: "GC=F", label: "Gold" },
                { v: "CL=F", label: "Crude Oil" },
                { v: "^AXJO", label: "ASX 200" },
              ] as const).map((m) => (
                <button key={m.v} onClick={() => setDataSymbol(m.v)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                    dataSymbol === m.v ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white" : "panel-2 border-[var(--color-border)] text-[var(--color-muted)]"}`}>
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--color-muted)] mt-1.5">
              These are <strong className="text-[var(--color-text)]">~24/5 futures</strong> — tradeable outside ASX hours.
              Set the <strong className="text-[var(--color-text)]">IG epic</strong> above to the matching market (find it with
              <code className="mono"> scripts/ig-markets.ts</code>). The data feed and your IG instrument should track the same underlying.
            </p>

            <div className="mt-3">
              <div className="text-xs text-[var(--color-muted)] mb-1.5">Timeframe (candle size)</div>
              <div className="flex flex-wrap gap-1.5">
                {(["5m", "15m", "30m", "60m"] as const).map((tf) => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                      timeframe === tf ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white" : "panel-2 border-[var(--color-border)] text-[var(--color-muted)]"}`}>
                    {tf === "60m" ? "1h" : tf}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--color-muted)] mt-1.5">
                Higher = fewer but cleaner signals. The auto-run checks once per candle (every {pollMin} min). 5m is noisy;
                30m/1h are calmer.
              </p>
            </div>
          </div>
        )}
        <div>
          <div className="text-xs text-[var(--color-muted)] mb-1.5">Capital to deploy</div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-muted)]">$</span>
            <input type="number" value={capital} onChange={(e) => setCapital(e.target.value)}
              placeholder={account ? `${account.equity} (full balance)` : "full balance"}
              className="w-48 px-3 py-2 rounded-lg panel-2 border border-[var(--color-border)] mono text-sm focus:outline-none focus:border-[var(--color-accent)]" />
            <span className="text-[11px] text-[var(--color-muted)]">
              How much the bot sizes from. Blank = full balance. Capped at your real balance.
              {account && capital && Number(capital) > account.equity && (
                <strong className="text-[var(--color-warn)]"> Above your balance — will be capped at ${account.equity}.</strong>
              )}
            </span>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendRealOrders} onChange={(e) => setSendRealOrders(e.target.checked)} />
          Actually place orders ({live ? "real money" : "real demo orders"}). Off = dry-run (logs the order, sends nothing).
        </label>

        {liveArmed && (
          <div className="rounded-xl border border-[var(--color-down)]/50 bg-[var(--color-down)]/10 p-4 space-y-2">
            <div className="text-sm font-semibold text-[var(--color-down)]">You are arming LIVE real-money trading.</div>
            <div className="text-xs text-[var(--color-muted)]">To confirm, type exactly: <code className="mono text-[var(--color-text)]">{LIVE_PHRASE}</code></div>
            <input className={field} value={confirmPhrase} onChange={(e) => setConfirmPhrase(e.target.value)} placeholder="type the phrase to confirm" />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={runOnce} disabled={!canRun}
            className="px-5 py-2.5 rounded-lg font-semibold bg-[var(--color-accent)] text-white disabled:opacity-40">
            {busy ? "Working…" : "Evaluate / trade now"}
          </button>
          <button onClick={toggleAuto} disabled={!canRun && !auto}
            className={`px-5 py-2.5 rounded-lg font-semibold border transition ${
              auto ? "bg-[var(--color-down)] border-[var(--color-down)] text-white" : "panel-2 border-[var(--color-border)] text-[var(--color-text)]"}`}>
            {auto ? "■ Stop auto-run" : `▶ Auto-run every ${pollMin} min`}
          </button>
          {auto && <span className="text-xs text-[var(--color-up)] animate-pulse">● running — keep this tab open</span>}
        </div>
        {error && <div className="text-sm text-[var(--color-down)]">✗ {error}</div>}
      </section>

      {/* LOG */}
      <section className="panel p-6">
        <h2 className="text-lg font-semibold mb-3">3 · Activity</h2>
        {log.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No evaluations yet. Connect, arm, then run.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[var(--color-muted)] text-xs uppercase">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-2 py-2">Time</th><th className="text-left px-2 py-2">Mode</th>
                  <th className="text-right px-2 py-2">Signal</th><th className="text-left px-2 py-2">Action</th>
                  <th className="text-left px-2 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {log.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)]/50">
                    <td className="px-2 py-2 mono text-xs">{r.t}</td>
                    <td className="px-2 py-2">{r.mode}</td>
                    <td className="px-2 py-2 text-right mono">{r.prob}%</td>
                    <td className="px-2 py-2"><span className={r.action.includes("order") ? "up" : r.action.includes("error") || r.action === "blocked" ? "down" : ""}>{r.action}</span></td>
                    <td className="px-2 py-2 text-xs text-[var(--color-muted)]">{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-[var(--color-muted)] text-center leading-relaxed">
        Educational tool, not financial advice. Leveraged CFD trading can lose more than your deposit. The strategy&apos;s
        edge is unproven — measure it on Demo before risking real money.
      </p>
    </div>
  );
}
