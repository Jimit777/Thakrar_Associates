"use client";

import { useState, useTransition } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getPriceHistory } from "@/app/(app)/analyzer/price";
import { PRICE_RANGES, type PriceHistory, type PriceRangeId } from "@/lib/prices";

const SERIES_BLUE = "#0369A1";
const INK = "#7c2d12";
const MUTED = "#a4552a";
const GRID = "#f0d6bf";
const SURFACE = "#fffdfb";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const compact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatPrice = (value: unknown) =>
  typeof value === "number" ? rupees.format(value) : "—";

/**
 * Axis labels are chosen by how much *time* the chart covers, not by how many
 * points it has. A ten-year chart drawn from monthly candles has few points but
 * still needs years on the axis.
 */
function formatAxisDate(value: string, spanDays: number) {
  const date = new Date(value);

  if (spanDays > 730) return String(date.getFullYear());
  if (spanDays > 120)
    return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Tooltips always name the full date — the axis is abbreviated, this isn't. */
function formatTooltipDate(value: unknown) {
  if (typeof value !== "string") return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const buttonBase =
  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors border";

export function PriceChart({
  symbol,
  initialHistory,
  initialError,
}: {
  symbol: string;
  initialHistory: PriceHistory | null;
  initialError: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [history, setHistory] = useState<PriceHistory | null>(initialHistory);
  const [error, setError] = useState<string | null>(initialError);
  const [activeRange, setActiveRange] = useState<PriceRangeId | "custom">("1y");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  function load(selection: { range?: string; from?: string; to?: string }) {
    setError(null);
    startTransition(async () => {
      const result = await getPriceHistory(symbol, selection);
      if (result.ok) setHistory(result.history);
      else {
        setError(result.error);
        setHistory(null);
      }
    });
  }

  function selectRange(range: PriceRangeId) {
    setActiveRange(range);
    setShowCustom(false);
    load({ range });
  }

  function applyCustom() {
    if (!customFrom || !customTo) return setError("Enter both dates.");
    setActiveRange("custom");
    load({ from: customFrom, to: customTo });
  }

  const points = history?.points ?? [];

  // Actual elapsed time, which is what the axis labels should follow.
  const spanDays =
    points.length > 1
      ? (new Date(points[points.length - 1].date).getTime() -
          new Date(points[0].date).getTime()) /
        86_400_000
      : 0;

  const first = points[0]?.close;
  const last = points[points.length - 1]?.close;
  const change =
    first !== undefined && last !== undefined && first !== 0
      ? ((last - first) / first) * 100
      : null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium">Price history</h2>
          <p className="mt-0.5 text-xs text-muted">
            {history ? history.ticker : symbol} · daily closing price
          </p>
        </div>

        {last !== undefined && (
          <div className="text-right">
            <p className="figure text-2xl">{rupees.format(last)}</p>
            {change !== null && (
              <p
                className={`figure text-xs ${
                  change >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}% over this period
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {PRICE_RANGES.map((range) => (
          <button
            key={range.id}
            type="button"
            onClick={() => selectRange(range.id)}
            disabled={pending}
            className={`${buttonBase} ${
              activeRange === range.id
                ? "border-accent bg-accent text-background"
                : "border-border hover:border-accent hover:text-accent"
            } disabled:opacity-50`}
          >
            {range.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setShowCustom((open) => !open)}
          className={`${buttonBase} ${
            activeRange === "custom"
              ? "border-accent bg-accent text-background"
              : "border-border hover:border-accent hover:text-accent"
          }`}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface-sunken p-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="stat-label">From</span>
            <input
              type="date"
              value={customFrom}
              max={today}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="figure rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="stat-label">To</span>
            <input
              type="date"
              value={customTo}
              max={today}
              onChange={(event) => setCustomTo(event.target.value)}
              className="figure rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
            />
          </label>

          <button
            type="button"
            onClick={applyCustom}
            disabled={pending}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Apply
          </button>

          <p className="text-xs text-muted">Minimum window: one month.</p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      <div className="mt-4 h-72">
        {pending && points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Loading prices…
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            No price data for this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={GRID}
                tick={{ fill: MUTED, fontSize: 11 }}
                tickLine={false}
                minTickGap={40}
                tickFormatter={(value: string) => formatAxisDate(value, spanDays)}
              />
              <YAxis
                stroke={GRID}
                tick={{ fill: MUTED, fontSize: 11 }}
                tickLine={false}
                width={58}
                domain={["auto", "auto"]}
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
                labelFormatter={formatTooltipDate}
                formatter={formatPrice}
              />
              <Line
                type="monotone"
                dataKey="close"
                name="Close"
                stroke={SERIES_BLUE}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: SURFACE }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="mt-2 text-xs text-muted">
        Delayed prices from Yahoo Finance. Not live, and not for trading decisions.
      </p>
    </section>
  );
}
