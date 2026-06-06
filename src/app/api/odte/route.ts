import { odteMarket } from "@/lib/engine";
import type { Market } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = (searchParams.get("market") || "all") as Market | "all";
  try {
    const data = await odteMarket(market);
    return Response.json({ market, ...data });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "odte failed" },
      { status: 500 },
    );
  }
}
