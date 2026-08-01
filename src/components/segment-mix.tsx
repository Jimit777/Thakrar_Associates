"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FinancialRow, Segment } from "@/types/financial";

/*
 * Segment colours are chosen to differ in hue *and* lightness, so the series
 * stay separable for a reader with colour vision deficiency and in print. The
 * first is the app's clay, so the primary segment matches the rest of the page.
 */
const PALETTE = [
  "#A9502F",
  "#0072B2",
  "#7E22CE",
  "#0F766E",
  "#334155",
  "#BE185D",
];

const MUTED = "#6B7280";
const GRID = "#E5E7EB";
const SURFACE = "#FFFFFF";
const INK = "#111827";

const compact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const full = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

const formatMoney = (value: unknown) =>
  typeof value === "number" ? full.format(value) : "—";

type Kind = Segment["kind"];

const KIND_LABELS: Record<Kind, string> = {
  business: "By business",
  geography: "By geography",
};

/**
 * What the company is actually made of. Annual reports disclose this in the
 * segment note, which is where a headline revenue figure stops being one number
 * and becomes three or four businesses moving in different directions.
 */
export function SegmentMix({ rows }: { rows: FinancialRow[] }) {
  // Only annual periods: quarterly segment disclosure is patchy, and mixing the
  // two would make a stacked bar jump between three months and twelve.
  const annual = rows.filter(
    (row) => row.period_type === "annual" && (row.data.segments?.length ?? 0) > 0,
  );

  const kinds = (["business", "geography"] as const).filter((kind) =>
    annual.some((row) => row.data.segments?.some((s) => s.kind === kind)),
  );

  const [kind, setKind] = useState<Kind>(kinds[0] ?? "business");

  if (annual.length === 0 || kinds.length === 0) return null;

  const activeKind = kinds.includes(kind) ? kind : kinds[0];
  const periods = annual.filter((row) =>
    row.data.segments?.some((s) => s.kind === activeKind),
  );

  // One column per segment name, so a segment that appears late simply starts
  // at zero rather than shifting the others along.
  const names = [
    ...new Set(
      periods.flatMap((row) =>
        (row.data.segments ?? [])
          .filter((s) => s.kind === activeKind)
          .map((s) => s.name),
      ),
    ),
  ];

  const data = periods.map((row) => {
    const point: Record<string, string | number | null> = {
      period: row.period_label,
    };

    for (const name of names) {
      const segment = (row.data.segments ?? []).find(
        (s) => s.kind === activeKind && s.name === name,
      );
      point[name] = segment?.revenue ?? null;
    }

    return point;
  });

  const latest = periods[periods.length - 1];
  const latestSegments = (latest.data.segments ?? []).filter(
    (s) => s.kind === activeKind,
  );
  const latestTotal = latestSegments.reduce(
    (sum, segment) => sum + (segment.revenue ?? 0),
    0,
  );

  const unit = latest.currency_unit ?? "as reported";

  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-base font-medium">Revenue mix</h2>
          <p className="mt-0.5 text-xs text-muted">
            From the segment note · figures in {unit}
          </p>
        </div>

        {kinds.length > 1 && (
          <div className="flex gap-1.5">
            {kinds.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setKind(candidate)}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                  activeKind === candidate
                    ? "border-accent bg-accent text-background"
                    : "border-border hover:border-accent hover:text-accent"
                }`}
              >
                {KIND_LABELS[candidate]}
              </button>
            ))}
          </div>
        )}
      </div>

      {data.length > 1 && (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="period"
                stroke={GRID}
                tick={{ fill: MUTED, fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke={GRID}
                tick={{ fill: MUTED, fontSize: 11 }}
                tickLine={false}
                width={52}
                tickFormatter={(value: number) => compact.format(value)}
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
                cursor={{ fill: GRID, fillOpacity: 0.35 }}
                formatter={formatMoney}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: MUTED }} />
              {names.map((name, index) => (
                <Bar
                  key={name}
                  dataKey={name}
                  name={name}
                  stackId="revenue"
                  fill={PALETTE[index % PALETTE.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-5">
        <p className="stat-label">Share of revenue in {latest.period_label}</p>

        <ul className="mt-2 space-y-2.5">
          {[...latestSegments]
            .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
            .map((segment) => {
              const share =
                segment.revenue === null || latestTotal === 0
                  ? null
                  : (segment.revenue / latestTotal) * 100;
              const margin =
                segment.revenue && segment.profit !== null && segment.revenue !== 0
                  ? (segment.profit / segment.revenue) * 100
                  : null;
              const colour =
                PALETTE[names.indexOf(segment.name) % PALETTE.length];

              return (
                <li key={segment.name}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: colour }}
                        aria-hidden
                      />
                      {segment.name}
                    </span>
                    <span className="figure text-muted">
                      {segment.revenue === null ? "—" : full.format(segment.revenue)}
                      {share !== null && (
                        <span className="ml-2 text-foreground">
                          {share.toFixed(1)}%
                        </span>
                      )}
                      {margin !== null && (
                        <span className="ml-2">
                          margin {margin.toFixed(1)}%
                        </span>
                      )}
                    </span>
                  </div>

                  {share !== null && (
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${share}%`, background: colour }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
        </ul>

        <p className="mt-3 text-xs text-muted">
          Shares are of the segments disclosed, which may not add to total
          revenue — reports keep unallocated items outside the segment note.
        </p>
      </div>
    </section>
  );
}
