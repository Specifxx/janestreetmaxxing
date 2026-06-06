"use client";

import { recColor, scoreColor } from "@/lib/format";

export function RecPill({ rec }: { rec: string }) {
  const c = recColor(rec);
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold"
      style={{ background: `${c}22`, color: c, border: `1px solid ${c}55` }}
    >
      {rec}
    </span>
  );
}

export function ScoreBar({ score, label }: { score: number; label?: string }) {
  const c = scoreColor(score);
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-[var(--color-muted)] mb-1">
          <span>{label}</span>
          <span className="mono" style={{ color: c }}>
            {score.toFixed(0)}
          </span>
        </div>
      )}
      <div className="h-2 rounded-full bg-[var(--color-panel-2)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, score)}%`, background: c }}
        />
      </div>
    </div>
  );
}

export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const c = scoreColor(score);
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-panel-2)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold mono" style={{ color: c }}>
          {score.toFixed(0)}
        </span>
        <span className="text-[10px] text-[var(--color-muted)]">/ 100</span>
      </div>
    </div>
  );
}

export function DataTag({ source }: { source: "live" | "sample" }) {
  if (source === "live")
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-up)]/15 text-[var(--color-up)] border border-[var(--color-up)]/30">
        ● LIVE
      </span>
    );
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-warn)]/15 text-[var(--color-warn)] border border-[var(--color-warn)]/30">
      SAMPLE DATA
    </span>
  );
}

export function Change({ pct }: { pct: number }) {
  return (
    <span className={pct >= 0 ? "up" : "down"}>
      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-[var(--color-muted)] py-10 justify-center">
      <span className="inline-block w-5 h-5 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
      {label || "Crunching the numbers…"}
    </div>
  );
}
