import { fetch5m } from "@/lib/orb/data";
import { runComparison } from "@/lib/strategies/compare";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/orb/compare — backtests ORB vs Heikin Ashi over the last ~60 days of
// 5-min ASX200 data and returns a head-to-head scoreboard. No credentials.
export async function GET() {
  try {
    const bars = await fetch5m("^AXJO");
    if (bars.length < 100) {
      return Response.json({ ok: false, error: "Not enough intraday history returned" }, { status: 502 });
    }
    return Response.json({ ok: true, ...runComparison(bars) });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "compare failed" },
      { status: 500 },
    );
  }
}
