/*
 * List what's TRADEABLE on your IG demo right now — and which markets are
 * "futures" (dated) vs undated CFDs. Read-only: it places no orders.
 *
 * Setup (DEMO creds):
 *   export IG_API_KEY=...  IG_USERNAME=...  IG_PASSWORD=...
 *
 * Run:
 *   npx tsx scripts/ig-markets.ts                 # scans common index/FX/commodity terms
 *   npx tsx scripts/ig-markets.ts "US 500"        # search a specific term
 */
import { IGBroker } from "@/lib/orb/broker";

async function main() {
  const { IG_API_KEY, IG_USERNAME, IG_PASSWORD } = process.env;
  if (!IG_API_KEY || !IG_USERNAME || !IG_PASSWORD) {
    console.error("✗ Set IG_API_KEY, IG_USERNAME, IG_PASSWORD (DEMO creds).");
    process.exit(1);
  }
  const custom = process.argv.slice(2).filter((a) => !a.startsWith("-")).join(" ").trim();
  const terms = custom
    ? [custom]
    : ["Australia 200", "US 500", "Wall Street", "US Tech 100", "Germany 40", "FTSE 100", "Spot Gold", "Oil - US Crude"];

  const broker = new IGBroker({
    apiKey: IG_API_KEY, username: IG_USERNAME, password: IG_PASSWORD,
    live: false, epic: "", liveConfirmed: true,
  });

  console.log("Querying IG DEMO market list (read-only)…\n");
  for (const term of terms) {
    try {
      const markets = await broker.searchMarkets(term);
      if (!markets.length) { console.log(`— ${term}: no matches`); continue; }
      console.log(`■ ${term}`);
      for (const m of markets.slice(0, 6)) {
        const tradeable = m.status === "TRADEABLE";
        const kind = m.expiry && m.expiry !== "DFB" && m.expiry !== "-" ? `FUTURES exp ${m.expiry}` : "undated CFD";
        console.log(`   ${tradeable ? "✓ OPEN " : "· " + (m.status || "?").padEnd(6)} ${m.name}`);
        console.log(`        epic=${m.epic}  (${kind})`);
      }
      console.log();
    } catch (e) {
      console.error(`✗ ${term}: ${e instanceof Error ? e.message : e}`);
      if (e instanceof Error && /network|allowlist|ENOTFOUND|fetch failed/i.test(e.message)) {
        console.error("  (Run on a normal connection — this sandbox blocks egress to IG.)");
        break;
      }
    }
  }
  console.log("✓ = tradeable right now. Use the epic in /autopilot or the bot config.");
  console.log("Note: IG index 'futures' are still CFDs. The ORB bot only makes sense on Australia 200 during ASX hours.");
}

main();

export {};
