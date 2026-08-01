import { computeRatios } from "@/lib/ratios";
import { formatRupeeScale } from "@/lib/units";
import type { Valuation } from "@/lib/valuation";
import type { FinancialRow } from "@/types/financial";

/**
 * The subject company's row in the peer table, built here rather than asked of
 * the model.
 *
 * The user extracted and checked these figures. Sending them through a model to
 * come back as a table cell can only make them worse, so the model is asked for
 * the peers alone and this fills in the column that faces them.
 */
export type ComparisonRow = {
  period: string;
  market_cap: string;
  pe: string;
  revenue_growth: string;
  operating_margin: string;
  roe: string;
  debt_to_equity: string;
};

const num = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function selfComparisonRow(
  rows: FinancialRow[],
  valuation: Valuation | null,
): ComparisonRow | null {
  const annual = rows.filter((row) => row.period_type === "annual");
  const consolidated = annual.filter((row) => row.basis === "consolidated");
  const pool = consolidated.length > 0 ? consolidated : annual;

  if (pool.length === 0) return null;

  const latest = pool[pool.length - 1];
  const previous = pool.length > 1 ? pool[pool.length - 2] : null;
  const ratios = computeRatios(latest.data);

  // Year on year rather than the scorecard's compound rate: peers are quoted on
  // their latest year, and comparing a CAGR against one is not a comparison.
  const current = num(latest.data.income_statement?.revenue);
  const prior = previous
    ? num(previous.data.income_statement?.revenue)
    : null;

  const growth =
    current !== null && prior !== null && prior > 0
      ? ((current - prior) / prior) * 100
      : null;

  return {
    period: latest.period_label,
    market_cap:
      valuation?.marketCap != null ? formatRupeeScale(valuation.marketCap) : "",
    pe: valuation?.peRatio != null ? `${valuation.peRatio.toFixed(1)}x` : "",
    revenue_growth: growth === null ? "" : `${growth.toFixed(1)}%`,
    operating_margin: ratios.opm === null ? "" : `${ratios.opm.toFixed(1)}%`,
    roe: ratios.roe === null ? "" : `${ratios.roe.toFixed(1)}%`,
    debt_to_equity:
      ratios.debt_to_equity === null
        ? ""
        : `${ratios.debt_to_equity.toFixed(2)}x`,
  };
}
