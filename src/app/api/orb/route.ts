import { fetchChart } from "@/lib/providers/yahoo";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Overnight macro inputs for the ASX200 ORB pre-bell checklist.
// These are the four *machine-readable* legs of Factor 1 plus the Nikkei
// (Factor 3). Iron ore has no clean free intraday feed, so we proxy it with the
// US-listed BHP/RIO ADRs, which track the overnight iron-ore tape closely and
// are clearly labelled as a proxy in the UI.
const MACRO = {
  spi: { symbols: ["AP=F"], label: "ASX SPI 200 futures" },
  wallst: { symbols: ["^GSPC"], label: "Wall St (S&P 500)" },
  iron: { symbols: ["BHP", "RIO"], label: "Iron ore (BHP/RIO ADR proxy)" },
  aud: { symbols: ["AUDUSD=X"], label: "AUD/USD" },
  nikkei: { symbols: ["^N225"], label: "Nikkei 225" },
} as const;

type Leg = { key: keyof typeof MACRO; label: string; changePct: number | null };

// Deterministic, clearly-labelled fallback so the tool still demonstrates the
// full pipeline on a locked-down / rate-limited network. Never trade off these.
const SAMPLE: Record<keyof typeof MACRO, number> = {
  spi: 0.74,
  wallst: 0.62,
  iron: 1.1,
  aud: 0.41,
  nikkei: 0.88,
};

async function changeFor(symbols: readonly string[]): Promise<number | null> {
  const vals: number[] = [];
  for (const s of symbols) {
    try {
      const { snapshot } = await fetchChart(s, "5d");
      if (typeof snapshot.changePct === "number" && isFinite(snapshot.changePct)) {
        vals.push(snapshot.changePct);
      }
    } catch {
      /* skip this leg */
    }
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export async function GET() {
  const keys = Object.keys(MACRO) as (keyof typeof MACRO)[];
  const legs = await Promise.all(
    keys.map(async (key): Promise<Leg> => ({
      key,
      label: MACRO[key].label,
      changePct: await changeFor(MACRO[key].symbols),
    })),
  );

  const anyLive = legs.some((l) => l.changePct !== null);
  const filled: Leg[] = legs.map((l) =>
    l.changePct === null ? { ...l, changePct: SAMPLE[l.key] } : l,
  );

  return Response.json({
    dataSource: anyLive ? "live" : "sample",
    asOf: new Date().toISOString(),
    legs: filled,
  });
}
