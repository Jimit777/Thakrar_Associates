"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IndexedPoint } from "@/lib/portfolio-analytics";

const CLAY = "#A9502F";
const SLATE = "#64748B";
const MUTED = "#6B7280";
const GRID = "#E5E7EB";
const SURFACE = "#FFFFFF";
const INK = "#111827";

/** Both lines are rebased to 100, so the axis is an index rather than rupees. */
const formatLevel = (value: unknown) =>
  typeof value === "number" ? value.toFixed(1) : "—";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}

export function IndexComparisonChart({ series }: { series: IndexedPoint[] }) {
  return (
    <div className="mt-4 h-56 sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            stroke={GRID}
            tick={{ fill: MUTED, fontSize: 11 }}
            tickLine={false}
            minTickGap={40}
            tickFormatter={formatDate}
          />
          <YAxis
            stroke={GRID}
            tick={{ fill: MUTED, fontSize: 11 }}
            tickLine={false}
            width={44}
            domain={["auto", "auto"]}
            tickFormatter={(value: number) => value.toFixed(0)}
          />
          <Tooltip
            contentStyle={{
              background: SURFACE,
              border: `1px solid ${GRID}`,
              borderRadius: 8,
              fontSize: 12,
              color: INK,
            }}
            labelStyle={{ color: MUTED, marginBottom: 4 }}
            labelFormatter={(value: unknown) =>
              typeof value === "string"
                ? new Date(value).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : ""
            }
            formatter={formatLevel}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: MUTED }} />
          <Line
            type="monotone"
            dataKey="portfolio"
            name="Your portfolio"
            stroke={CLAY}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="index"
            name="Nifty 50"
            stroke={SLATE}
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
