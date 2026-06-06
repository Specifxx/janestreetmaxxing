// Reddit retail-sentiment signal. Counts ticker mentions across the relevant
// subreddits and converts the buzz (with crude positive/negative keyword bias)
// into a 0-100 score per symbol. Treated as a *minor* input — retail chatter is
// a weak, lagging signal, so it carries the smallest weight in the composite.

import { cached } from "@/lib/cache";

const UA = "Mozilla/5.0 (compatible; stock-analysis-app/1.0)";

const SUBS_US = ["wallstreetbets", "stocks", "investing"];
const SUBS_AU = ["ASX_Bets", "ausstocks", "AusFinance"];

const POS = /\b(moon|calls|buy|bull|long|breakout|squeeze|rocket|undervalued|🚀|🌙)\b/i;
const NEG = /\b(puts|short|bear|sell|dump|crash|overvalued|baghold)\b/i;

interface SubPost {
  title: string;
  selftext?: string;
  ups: number;
}

async function fetchSub(sub: string): Promise<SubPost[]> {
  try {
    const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=100`, {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return (data?.data?.children ?? []).map((c: any) => ({
      title: c.data.title ?? "",
      selftext: c.data.selftext ?? "",
      ups: c.data.ups ?? 0,
    }));
  } catch {
    return [];
  }
}

export interface SocialBuzz {
  mentions: number;
  bullishPct: number; // 0..1
  score: number; // 0..100
  rank: number; // among scanned symbols
}

// Returns a map of bare-ticker -> buzz (US tickers without suffix; AU map uses
// the root before ".AX").
export async function fetchRedditBuzz(market: "us" | "au"): Promise<Map<string, SocialBuzz>> {
  return cached(`reddit:${market}`, 15 * 60_000, async () => {
    const subs = market === "au" ? SUBS_AU : SUBS_US;
    const posts = (await Promise.all(subs.map(fetchSub))).flat();
    const tally = new Map<string, { count: number; pos: number; neg: number }>();
    // Match $TICKER or standalone 2-5 letter uppercase tokens.
    const re = /\$?\b([A-Z]{2,5})\b/g;
    for (const p of posts) {
      const text = `${p.title} ${p.selftext ?? ""}`;
      const pos = POS.test(text);
      const neg = NEG.test(text);
      const seen = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const t = m[1];
        if (STOPWORDS.has(t)) continue;
        if (seen.has(t)) continue;
        seen.add(t);
        const cur = tally.get(t) ?? { count: 0, pos: 0, neg: 0 };
        cur.count += 1 + Math.log10(1 + p.ups);
        if (pos) cur.pos += 1;
        if (neg) cur.neg += 1;
        tally.set(t, cur);
      }
    }
    const entries = [...tally.entries()].sort((a, b) => b[1].count - a[1].count);
    const max = entries[0]?.[1].count ?? 1;
    const out = new Map<string, SocialBuzz>();
    entries.forEach(([t, v], i) => {
      const bullishPct = v.pos + v.neg > 0 ? v.pos / (v.pos + v.neg) : 0.5;
      const buzz = (v.count / max) * 100;
      // Blend buzz volume with directional bias.
      const score = Math.round(buzz * 0.5 + bullishPct * 100 * 0.5);
      out.set(t, { mentions: Math.round(v.count), bullishPct, score, rank: i + 1 });
    });
    return out;
  });
}

// Common uppercase words that are not tickers.
const STOPWORDS = new Set([
  "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER", "WAS",
  "ONE", "OUR", "OUT", "DAY", "GET", "HAS", "HIM", "HOW", "MAN", "NEW", "NOW",
  "OLD", "SEE", "TWO", "WAY", "WHO", "BOY", "DID", "ITS", "LET", "PUT", "SAY",
  "SHE", "TOO", "USE", "CEO", "CFO", "IPO", "USA", "USD", "AUD", "ATH", "DD",
  "YOLO", "FD", "WSB", "ER", "EPS", "PE", "ETF", "FOMO", "HODL", "IMO", "TLDR",
  "EDIT", "LMAO", "LOL", "WTF", "OP", "RH", "PT", "EOD", "AH", "PM", "GDP",
  "USE", "API", "URL", "FAQ", "AMA", "OK", "NASA", "FBI", "EU", "UK", "AU",
]);
