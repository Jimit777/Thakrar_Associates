import { computeRatios } from "@/lib/ratios";
import { formatRupeeScale } from "@/lib/units";
import type { Valuation } from "@/lib/valuation";
import type { FinancialRow } from "@/types/financial";

/**
 * The subject company's figures, computed here rather than read off a web page.
 *
 * The user extracted and checked these. Where a column in the peer table is one
 * the app can work out, this value replaces whatever the model found — a figure
 * you verified beats a figure someone published about you.
 *
 * Keyed by the canonical labels in peers-schema, which is how the two meet.
 */
export type ComputedFigures = {
  period: string;
  values: Map<string, string>;
};

const num = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function computeOwnFigures(
  rows: FinancialRow[],
  valuation: Valuation | null,
): ComputedFigures | null {
  const annual = rows.filter((row) => row.period_type === "annual");
  const consolidated = annual.filter((row) => row.basis === "consolidated");
  const pool = consolidated.length > 0 ? consolidated : annual;

  if (pool.length === 0) return null;

  const latest = pool[pool.length - 1];
  const previous = pool.length > 1 ? pool[pool.length - 2] : null;
  const ratios = computeRatios(latest.data);

  // Year on year, not the scorecard's compound rate: peers are quoted on their
  // latest year, and a CAGR set against one of those is not a comparison.
  const current = num(latest.data.income_statement?.revenue);
  const prior = previous ? num(previous.data.income_statement?.revenue) : null;
  const growth =
    current !== null && prior !== null && prior > 0
      ? ((current - prior) / prior) * 100
      : null;

  const values = new Map<string, string>();
  const set = (label: string, value: string | null) => {
    if (value !== null) values.set(label, value);
  };

  set(
    "Market cap",
    valuation?.marketCap != null ? formatRupeeScale(valuation.marketCap) : null,
  );
  set("P/E", valuation?.peRatio != null ? `${valuation.peRatio.toFixed(1)}x` : null);
  set("Revenue growth", growth === null ? null : `${growth.toFixed(1)}%`);
  set(
    "Operating margin",
    ratios.opm === null ? null : `${ratios.opm.toFixed(1)}%`,
  );
  set("Return on equity", ratios.roe === null ? null : `${ratios.roe.toFixed(1)}%`);
  set(
    "Debt / equity",
    ratios.debt_to_equity === null
      ? null
      : `${ratios.debt_to_equity.toFixed(2)}x`,
  );

  return values.size === 0
    ? null
    : { period: latest.period_label, values };
}
