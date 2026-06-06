"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ScreenResult } from "@/lib/types";

// Scrolling market ribbon. Pulls a live screen; falls back to a static set so
// the ribbon never looks empty.
const FALLBACK: { symbol: string; changePct: number }[] = [
  { symbol: "AAPL", changePct: 0.8 }, { symbol: "NVDA", changePct: 2.1 },
  { symbol: "MSFT", changePct: -0.4 }, { symbol: "TSLA", changePct: 3.2 },
  { symbol: "BHP.AX", changePct: 0.6 }, { symbol: "CBA.AX", changePct: -0.3 },
  { symbol: "META", changePct: 1.4 }, { symbol: "AMZN", changePct: 0.9 },
  { symbol: "CSL.AX", changePct: -1.1 }, { symbol: "GOOGL", changePct: 0.5 },
  { symbol: "FMG.AX", changePct: 1.8 }, { symbol: "AMD", changePct: -0.7 },
];

export default function TickerTape() {
  const [items, setItems] = useState(FALLBACK);

  useEffect(() => {
    fetch("/api/screen?market=all&limit=40")
      .then((r) => r.json())
      .then((d) => {
        const rows: ScreenResult[] = d.results ?? [];
        if (rows.length) setItems(rows.map((r) => ({ symbol: r.symbol, changePct: r.changePct })));
      })
      .catch(() => {});
  }, []);

  const doubled = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-y border-[var(--color-border)] bg-[var(--color-panel)]/60 py-2.5">
      <div className="bs-marquee">
        {doubled.map((it, i) => (
          <Link
            key={i}
            href={`/stock/${encodeURIComponent(it.symbol)}`}
            className="inline-flex items-center gap-2 px-5 text-sm hover:text-[var(--color-text)]"
          >
            <span className="font-medium">{it.symbol}</span>
            <span className={`mono ${it.changePct >= 0 ? "up" : "down"}`}>
              {it.changePct >= 0 ? "▲" : "▼"} {Math.abs(it.changePct).toFixed(2)}%
            </span>
            <span className="text-[var(--color-border)]">|</span>
          </Link>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[var(--color-bg)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[var(--color-bg)] to-transparent" />
    </div>
  );
}
