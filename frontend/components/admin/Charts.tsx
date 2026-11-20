"use client";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Overview } from "@/lib/api";

// Validated categorical pair (CVD ΔE ≥ 28): Co-op = brand blue, New Grad = dark gold.
export const SERIES = { coop: "#005DAA", new_grad: "#A87400", all: "#1B2430" };
const axis = { fontSize: 12, fill: "#5B6675" };
const fmtWeek = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function SentimentTrend({ data, program }: { data: Overview["trend"]; program?: string }) {
  const series = program ? [program as "coop" | "new_grad"] : (["coop", "new_grad"] as const);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#EEF1F5" vertical={false} />
        <XAxis dataKey="week_start" tickFormatter={fmtWeek} tick={axis} tickLine={false} axisLine={{ stroke: "#DDE3EA" }} />
        <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tick={axis} tickLine={false} axisLine={false} />
        <ReferenceLine y={0} stroke="#9AA5B1" strokeDasharray="3 3" />
        <Tooltip
          formatter={(v: number, name: string) => [v === null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(2), name]}
          labelFormatter={(l) => `Week of ${fmtWeek(String(l))}`}
          contentStyle={{ borderRadius: 8, borderColor: "#DDE3EA", fontSize: 12 }}
        />
        {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Line key={s} type="monotone" dataKey={s} name={s === "coop" ? "Co-op" : "New Grad"} stroke={SERIES[s]} strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2, stroke: "#fff", fill: SERIES[s] }} activeDot={{ r: 5 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ThemeBars({ data }: { data: Overview["themes"] }) {
  const rows = data.map((t) => ({ ...t, label_text: `${Math.round(t.negative_share * 100)}% negative` }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 38)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 96, left: 8, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={150} tick={{ ...axis, fill: "#1B2430" }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "#F5F7FA" }}
          formatter={(v: number, _n, item) => [`${v} mentions · ${item.payload.label_text} · avg ${item.payload.avg_sentiment.toFixed(2)}`, "Posts & replies"]}
          contentStyle={{ borderRadius: 8, borderColor: "#DDE3EA", fontSize: 12 }}
        />
        <Bar dataKey="count" fill={SERIES.coop} radius={[0, 4, 4, 0]} barSize={18}>
          <LabelList dataKey="label_text" position="right" style={{ fontSize: 11, fill: "#5B6675" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
