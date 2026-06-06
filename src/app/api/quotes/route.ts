import { quoteMany } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

// GET /api/quotes?symbols=AAPL,MSFT,BHP.AX
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("symbols") || "").trim();
  if (!raw) return Response.json({ results: [] });
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const results = await quoteMany(symbols);
    return Response.json({ count: results.length, results });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "quotes failed" },
      { status: 500 },
    );
  }
}
