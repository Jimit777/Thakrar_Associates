"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { computeRatios } from "@/lib/ratios";
import type { FinancialRow } from "@/types/financial";

/**
 * Categorical series colours, validated for the light chart surface:
 * lightness band, chroma floor, colour-blind separation, and contrast.
 * Assigned in fixed order — a series keeps its colour regardless of what else
 * is on the chart.
 */
const SERIES = {
  blue: "#0369A1",
  orange: "#C2410C",
  purple: "#7E22CE",
} as const;

const INK = "#7c2d12";
const MUTED = "#a4552a";
const GRID = "#f0d6bf";
const SURFACE = "#fffdfb";

const compact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const full = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** Recharts passes tooltip values loosely typed, so narrow before formatting. */
const formatMoney = (value: unknown) =>
  typeof value === "number" ? full.format(value) : "—";

const formatPercent = (value: unknown) =>
  typeof value === "number" ? `${value.toFixed(1)}%` : "—";

const axisProps = {
  stroke: GRID,
  tick: { fill: MUTED, fontSize: 11 },
  tickLine: false,
} as const;

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: SURFACE,
    border: `1px solid ${GRID}`,
    borderRadius: 8,
    fontSize: 12,
    color: INK,
  },
  labelStyle: { color: MUTED, marginBottom: 4 },
  cursor: { fill: GRID, fillOpacity: 0.35 },
} as const;

const legendStyle = { fontSize: 12, color: MUTED } as const;

export function FinancialCharts({
  rows,
  unit,
  view,
}: {
  rows: FinancialRow[];
  unit: string | null;
  view: "annual" | "quarterly";
}) {
  // A single period is a number, not a trend — charts need something to compare.
  if (rows.length < 2) return null;

  const data = rows.map((row) => {
    const income = row.data.income_statement ?? {};
    const cash = row.data.cash_flow ?? {};
    const ratios = computeRatios(row.data);

    return {
      period: row.period_label,
      revenue: income.revenue ?? null,
      netProfit: income.net_profit ?? null,
      opm: ratios.opm,
      npm: ratios.npm,
      operating: cash.cash_from_operating ?? null,
      investing: cash.cash_from_investing ?? null,
      financing: cash.cash_from_financing ?? null,
    };
  });

  const has = (key: keyof (typeof data)[number]) =>
    data.some((row) => row[key] !== null && row[key] !== undefined);

  const unitLabel = unit ?? "as reported";
  const cadence = view === "annual" ? "Annual periods" : "Quarterly periods";
  const showEarnings = has("revenue") || has("netProfit");
  const showMargins = has("opm") || has("npm");
  const showCashFlow = has("operating") || has("investing") || has("financing");

  if (!showEarnings && !showMargins && !showCashFlow) return null;

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {showEarnings && (
        <ChartCard
          title="Revenue and net profit"
          subtitle={`${cadence} · figures in ${unitLabel}`}
        >
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="period" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v) => compact.format(v)} width={52} />
            <Tooltip
              {...tooltipStyle}
              formatter={formatMoney}
            />
            <Legend wrapperStyle={legendStyle} />
            <Bar
              dataKey="revenue"
              name="Revenue"
              fill={SERIES.blue}
              radius={[4, 4, 0, 0]}
              stroke={SURFACE}
              strokeWidth={2}
            />
            <Bar
              dataKey="netProfit"
              name="Net profit"
              fill={SERIES.orange}
              radius={[4, 4, 0, 0]}
              stroke={SURFACE}
              strokeWidth={2}
            />
          </BarChart>
        </ChartCard>
      )}

      {showMargins && (
        <ChartCard
          title="Margins"
          subtitle={`${cadence} · operating and net margin, per cent of revenue`}
        >
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="period" {...axisProps} />
            <YAxis
              {...axisProps}
              width={46}
              tickFormatter={(v) => `${Math.round(v)}%`}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={formatPercent}
            />
            <Legend wrapperStyle={legendStyle} />
            <Line
              type="monotone"
              dataKey="opm"
              name="Operating margin"
              stroke={SERIES.blue}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: SURFACE }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="npm"
              name="Net margin"
              stroke={SERIES.orange}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: SURFACE }}
              connectNulls
            />
          </LineChart>
        </ChartCard>
      )}

      {showCashFlow && (
        <ChartCard
          title="Cash flow"
          subtitle={`${cadence} · by activity, in ${unitLabel}`}
        >
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="period" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v) => compact.format(v)} width={52} />
            <Tooltip
              {...tooltipStyle}
              formatter={formatMoney}
            />
            <Legend wrapperStyle={legendStyle} />
            <Bar
              dataKey="operating"
              name="Operating"
              fill={SERIES.blue}
              radius={[4, 4, 0, 0]}
              stroke={SURFACE}
              strokeWidth={2}
            />
            <Bar
              dataKey="investing"
              name="Investing"
              fill={SERIES.orange}
              radius={[4, 4, 0, 0]}
              stroke={SURFACE}
              strokeWidth={2}
            />
            <Bar
              dataKey="financing"
              name="Financing"
              fill={SERIES.purple}
              radius={[4, 4, 0, 0]}
              stroke={SURFACE}
              strokeWidth={2}
            />
          </BarChart>
        </ChartCard>
      )}
    </div>
  );
}
