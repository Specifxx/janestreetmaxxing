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
    console.log("  Login + account read work. Next: verify a tiny order on demo (see AUTOMATION.md).");
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    console.error("  If this is a network error, run on a normal connection (this sandbox blocks egress).");
    process.exit(1);
  }
}

main();

export {};
