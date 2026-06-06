import { analyzeSymbol } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol) {
    return Response.json({ error: "missing ?symbol" }, { status: 400 });
  }
  try {
    const analysis = await analyzeSymbol(symbol);
    return Response.json(analysis);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "analysis failed" },
      { status: 500 },
    );
  }
}
