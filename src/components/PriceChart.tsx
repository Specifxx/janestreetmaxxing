"use client";

import {
  Area,
  AreaChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import type { OHLC } from "@/lib/types";

interface Props {
  history: OHLC[];
  target?: number | null;
  bull?: number | null;
  bear?: number | null;
  currency?: string;
}

export default function PriceChart({ history, target, bull, bear, currency = "USD" }: Props) {
  const data = history.slice(-180).map((b) => ({ date: b.date, close: b.adjClose || b.close }));
  const sym = currency === "AUD" ? "A$" : "$";

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="px" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f8cff" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#4f8cff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fill: "#8a96ad", fontSize: 11 }}
          minTickGap={48}
          tickFormatter={(d) => String(d).slice(5)}
        />
        <YAxis
          tick={{ fill: "#8a96ad", fontSize: 11 }}
          domain={["auto", "auto"]}
          width={56}
          tickFormatter={(v) => `${sym}${Number(v).toFixed(0)}`}
        />
        <Tooltip
          contentStyle={{
            background: "#121826",
            border: "1px solid #232c40",
            borderRadius: 10,
            color: "#e8edf6",
          }}
          formatter={(v: number) => [`${sym}${v.toFixed(2)}`, "Close"]}
        />
        {bear != null && (
          <ReferenceLine y={bear} stroke="#ea3943" strokeDasharray="4 4" label={{ value: "Bear", fill: "#ea3943", fontSize: 10, position: "insideRight" }} />
        )}
        {target != null && (
          <ReferenceLine y={target} stroke="#16c784" strokeDasharray="5 4" label={{ value: "Target", fill: "#16c784", fontSize: 10, position: "insideRight" }} />
        )}
        {bull != null && (
          <ReferenceLine y={bull} stroke="#5fd6a5" strokeDasharray="2 4" label={{ value: "Bull", fill: "#5fd6a5", fontSize: 10, position: "insideRight" }} />
        )}
        <Area type="monotone" dataKey="close" stroke="#4f8cff" strokeWidth={2} fill="url(#px)" />
        <Line type="monotone" dataKey="close" stroke="#4f8cff" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
