// Display formatting helpers (pure; usable on server or client).

export function fmtCcy(v: number | null | undefined, ccy = "USD"): string {
  if (v == null || !isFinite(v)) return "—";
  const sym = ccy === "AUD" ? "A$" : ccy === "USD" ? "$" : "";
  return `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(v: number | null | undefined, dp = 1): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(dp)}%`;
}

export function fmtNum(v: number | null | undefined, dp = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toFixed(dp);
}

export function fmtBig(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return v.toFixed(0);
}

export function recColor(rec: string): string {
  switch (rec) {
    case "Strong Buy":
      return "#0fae6e";
    case "Buy":
      return "#16c784";
    case "Accumulate":
      return "#5fd6a5";
    case "Hold":
      return "#8a96ad";
    case "Reduce":
      return "#f0b429";
    default:
      return "#ea3943";
  }
}

export function scoreColor(score: number): string {
  if (score >= 70) return "#16c784";
  if (score >= 55) return "#5fd6a5";
  if (score >= 45) return "#f0b429";
  return "#ea3943";
}
