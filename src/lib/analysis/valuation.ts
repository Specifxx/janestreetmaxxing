// Fundamental valuation models. Each returns a per-share fair value plus the
// exact formula and inputs used, so the UI can show the working.

import type {
  Fundamentals,
  Indicators,
  Snapshot,
  ValuationModel,
  PriceTargets,
} from "@/lib/types";

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

// ---- Discounted Cash Flow (2-stage FCF model) -----------------------------
// FV = Σ_{t=1..N} FCF_t / (1+r)^t  +  TV / (1+r)^N
// where FCF_t grows at g1 for N years, then a terminal value uses Gordon
// growth: TV = FCF_N * (1+g2) / (r - g2). Per-share = (Σ - netDebt) / shares.
export function dcf(f: Fundamentals): ValuationModel {
  const fcf = f.freeCashflow ?? f.operatingCashflow;
  const shares = f.sharesOutstanding;
  const name = "Discounted Cash Flow (2-stage)";
  const formula =
    "FV = Σ FCFₜ/(1+r)ᵗ + [FCF_N·(1+g₂)/(r−g₂)]/(1+r)ᴺ , per share = (FV − netDebt)/shares";

  if (!fcf || !shares || fcf <= 0) {
    return {
      name,
      fairValue: null,
      formula,
      inputs: { freeCashflow: fcf ?? null, sharesOutstanding: shares ?? null },
      note: "Skipped: requires positive free cash flow and share count.",
    };
  }

  // Growth: blend reported earnings/revenue growth, capped to a sane band.
  const rawG = f.earningsGrowth ?? f.revenueGrowth ?? 0.06;
  const g1 = clamp(rawG, -0.05, 0.2); // stage-1 growth, capped at 20%
  const g2 = 0.025; // terminal growth ≈ long-run GDP
  // Discount rate from beta via a simple CAPM-style build-up.
  const beta = clamp(f.beta ?? 1.1, 0.5, 2.2);
  const r = clamp(0.04 + beta * 0.05, 0.08, 0.16); // rf 4% + beta·ERP 5%
  const N = 5;

  let pv = 0;
  let cf = fcf;
  for (let t = 1; t <= N; t++) {
    cf = cf * (1 + g1);
    pv += cf / Math.pow(1 + r, t);
  }
  const terminal = (cf * (1 + g2)) / (r - g2);
  pv += terminal / Math.pow(1 + r, N);

  const netDebt = (f.totalDebt ?? 0) - (f.totalCash ?? 0);
  const equity = pv - netDebt;
  const perShare = equity / shares;

  return {
    name,
    fairValue: perShare > 0 ? perShare : null,
    formula,
    inputs: {
      FCF0: Math.round(fcf),
      "g1 (stage-1)": +(g1 * 100).toFixed(1) + "%",
      "g2 (terminal)": +(g2 * 100).toFixed(1) + "%",
      "r (discount)": +(r * 100).toFixed(1) + "%",
      beta,
      years: N,
      netDebt: Math.round(netDebt),
      shares: Math.round(shares),
    },
    note: "Two-stage FCF model; discount rate from CAPM (rf 4% + β·5% ERP).",
  };
}

// ---- Benjamin Graham number ------------------------------------------------
// FV = sqrt(22.5 · EPS · BookValuePerShare)  (caps P/E·P/B at 22.5)
export function graham(f: Fundamentals): ValuationModel {
  const eps = f.trailingEps;
  const bvps = f.bookValue;
  const name = "Graham Number";
  const formula = "FV = √(22.5 × EPS × BookValuePerShare)";
  if (!eps || !bvps || eps <= 0 || bvps <= 0) {
    return {
      name,
      fairValue: null,
      formula,
      inputs: { EPS: eps ?? null, bookValuePerShare: bvps ?? null },
      note: "Skipped: needs positive trailing EPS and book value.",
    };
  }
  const fv = Math.sqrt(22.5 * eps * bvps);
  return {
    name,
    fairValue: fv,
    formula,
    inputs: { EPS: eps, bookValuePerShare: bvps, multiple: 22.5 },
    note: "Classic defensive-value ceiling (Graham, 1949).",
  };
}

// ---- Earnings power: forward EPS × justified P/E (PEG-anchored) ------------
// Justified P/E = clamp(growth%, ...) i.e. a PEG of 1.0 baseline.
export function earningsPower(f: Fundamentals): ValuationModel {
  const eps = f.forwardEps ?? f.trailingEps;
  const name = "Forward Earnings Power (PEG-anchored)";
  const formula = "FV = ForwardEPS × justifiedP/E,  justifiedP/E = g% (PEG=1)";
  if (!eps || eps <= 0) {
    return {
      name,
      fairValue: null,
      formula,
      inputs: { forwardEps: eps ?? null },
      note: "Skipped: needs positive forward EPS.",
    };
  }
  const gPct = clamp((f.earningsGrowth ?? f.revenueGrowth ?? 0.08) * 100, 5, 35);
  const justifiedPE = clamp(gPct, 8, 35); // PEG = 1 baseline, floor/ceiling
  const fv = eps * justifiedPE;
  return {
    name,
    fairValue: fv,
    formula,
    inputs: {
      forwardEps: eps,
      "growth %": +gPct.toFixed(1),
      justifiedPE: +justifiedPE.toFixed(1),
    },
    note: "Values a fair P/E at the expected growth rate (PEG = 1).",
  };
}

// ---- Analyst consensus -----------------------------------------------------
export function analystTarget(f: Fundamentals): ValuationModel {
  const name = "Analyst Consensus";
  const formula = "Mean of sell-side 12-month price targets";
  if (!f.targetMeanPrice) {
    return {
      name,
      fairValue: null,
      formula,
      inputs: { targetMeanPrice: null },
      note: "No analyst coverage available.",
    };
  }
  return {
    name,
    fairValue: f.targetMeanPrice,
    formula,
    inputs: {
      mean: f.targetMeanPrice,
      high: f.targetHighPrice ?? null,
      low: f.targetLowPrice ?? null,
      "rec (1=buy,5=sell)": f.recommendationMean ?? null,
    },
    note: "Sell-side 12-month consensus.",
  };
}

export function buildValuations(f: Fundamentals): ValuationModel[] {
  return [dcf(f), graham(f), earningsPower(f), analystTarget(f)];
}

// Blend valuation models + a technical anchor into base/bull/bear targets.
export function blendPriceTargets(
  models: ValuationModel[],
  snapshot: Snapshot,
  ind: Indicators,
): PriceTargets {
  // Weighted blend: DCF 35%, Earnings power 25%, Analyst 25%, Graham 15%.
  const weightByName: Record<string, number> = {
    "Discounted Cash Flow (2-stage)": 0.35,
    "Forward Earnings Power (PEG-anchored)": 0.25,
    "Analyst Consensus": 0.25,
    "Graham Number": 0.15,
  };
  let wSum = 0;
  let acc = 0;
  const fvs: number[] = [];
  for (const m of models) {
    if (m.fairValue && m.fairValue > 0 && isFinite(m.fairValue)) {
      const w = weightByName[m.name] ?? 0.1;
      acc += m.fairValue * w;
      wSum += w;
      fvs.push(m.fairValue);
    }
  }

  if (wSum === 0) {
    // Fall back to a technical mean-reversion target if no fundamentals.
    const base = ind.sma50 ?? ind.bbMid ?? snapshot.price;
    return {
      base,
      bull: ind.bbUpper ?? base * 1.1,
      bear: ind.bbLower ?? base * 0.9,
      blendNote:
        "No usable fundamentals — technical target from SMA50 / Bollinger band.",
      upsidePct: ((base - snapshot.price) / snapshot.price) * 100,
    };
  }

  const base = acc / wSum;
  // Bull/bear from dispersion of the models plus a volatility cushion.
  const dispersion = fvs.length > 1 ? Math.max(...fvs) - Math.min(...fvs) : base * 0.15;
  const volCushion = ((ind.hv20 ?? 30) / 100) * base * 0.5;
  const spread = Math.max(dispersion / 2, volCushion);
  return {
    base,
    bull: base + spread,
    bear: Math.max(base - spread, 0),
    blendNote:
      "Weighted blend — DCF 35%, Earnings 25%, Analyst 25%, Graham 15%. Bull/bear from model dispersion + volatility.",
    upsidePct: ((base - snapshot.price) / snapshot.price) * 100,
  };
}
