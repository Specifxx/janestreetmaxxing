/*
 * IG connection smoke-test. Run this FIRST on your IG DEMO account to verify the
 * adapter can log in and read your balance — BEFORE letting the bot place
 * anything. It is read-only unless you explicitly arm orders.
 *
 * Setup (use DEMO credentials from https://labs.ig.com / your IG demo account):
 *   export IG_API_KEY=...          # demo API key
 *   export IG_USERNAME=...         # demo username
 *   export IG_PASSWORD=...         # demo password
 *   export IG_EPIC="IX.D.ASX.IFD.IP"   # verify the AUS200 epic in YOUR account
 *
 * Run:
 *   npx tsx scripts/ig-smoke-test.ts            # login + show balance (read-only)
 *
 * It will NOT place orders. To test a tiny real DEMO order, read AUTOMATION.md.
 */

import { IGBroker } from "@/lib/orb/broker";

async function main() {
  const { IG_API_KEY, IG_USERNAME, IG_PASSWORD, IG_EPIC } = process.env;
  if (!IG_API_KEY || !IG_USERNAME || !IG_PASSWORD) {
    console.error("✗ Missing env: set IG_API_KEY, IG_USERNAME, IG_PASSWORD (use DEMO creds).");
    process.exit(1);
  }
  const broker = new IGBroker({
    apiKey: IG_API_KEY,
    username: IG_USERNAME,
    password: IG_PASSWORD,
    live: false, // DEMO endpoint
    epic: IG_EPIC || "IX.D.ASX.IFD.IP",
  });

  console.log(`Connecting to IG DEMO (mode=${broker.mode})…`);
  try {
    const acct = await broker.getAccount();
    console.log(`✓ Connected. Balance: ${acct.equity} ${acct.currency}`);

    // Show the REAL minimum-trade economics for this instrument so you can see
    // whether $100 / $500 can actually carry one sane position.
    const mi = await broker.marketInfo();
    console.log(`\nInstrument: ${mi.name} @ ${mi.price}`);
    console.log(`  Min deal size: ${mi.minDealSize}  →  min exposure ≈ $${mi.minExposure.toFixed(0)}`);
    if (mi.minMargin != null)
      console.log(`  Margin to open one min position ≈ $${mi.minMargin.toFixed(0)} (factor ${mi.marginFactorPct}%)`);
    console.log(`  A 1% stop on that min position risks ≈ $${mi.minStopRiskAt1pct.toFixed(0)}`);
    for (const cap of [100, 500]) {
      const canOpen = mi.minMargin == null ? "unknown" : mi.minMargin <= cap ? "YES" : "NO — margin exceeds deposit";
      const riskPct = (mi.minStopRiskAt1pct / cap) * 100;
      console.log(`  With $${cap}: can open one min trade? ${canOpen} | one 1% stop = ${riskPct.toFixed(0)}% of account`);
    }
    console.log("\n  Login + reads work. Next: verify a tiny order on demo (see AUTOMATION.md).");
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    console.error("  If this is a network error, run on a normal connection (this sandbox blocks egress).");
    process.exit(1);
  }
}

main();

export {};
