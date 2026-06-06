import { screenMarket } from "@/lib/engine";
import type { Market } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = (searchParams.get("market") || "all") as Market | "all";
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 80);
  try {
    const results = await screenMarket(market, limit);
    return Response.json({ market, count: results.length, results });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "screen failed" },
      { status: 500 },
    );
  }
}
