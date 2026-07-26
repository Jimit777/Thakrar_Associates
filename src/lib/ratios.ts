import type { FinancialRow, PeriodFigures } from "@/types/financial";

/**
 * Ratios are calculated here from the confirmed figures — they are never asked
 * of the AI. Arithmetic the app does is reproducible and auditable; arithmetic
 * a model does is not.
 */

function divide(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function percent(numerator: number | null, denominator: number | null) {
  const value = divide(numerator, denominator);
  return value === null ? null : value * 100;
}

const num = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Operating profit as screener-style tables show it — revenue less operating
 * costs, before interest, depreciation, tax and other income.
 *
 * Indian filings rarely print this line: they report revenue, a single "total
 * expenses" figure that already includes interest and depreciation, and profit
 * before tax. Claude is told never to derive figures, so we reconstruct it here
 * where the arithmetic is visible and repeatable.
 */
export function operatingProfit(income: Record<string, number | null | undefined>): {
  value: number | null;
  derived: boolean;
} {
  const reported = num(income.operating_profit);
  if (reported !== null) return { value: reported, derived: false };

  const revenue = num(income.revenue);
  const expenses = num(income.total_expenses);
  const depreciation = num(income.depreciation) ?? 0;
  const interest = num(income.interest) ?? 0;

  if (revenue !== null && expenses !== null) {
    return { value: revenue - expenses + depreciation + interest, derived: true };
  }

  // Second route: work back from profit before tax.
  const pbt = num(income.profit_before_tax);
  const otherIncome = num(income.other_income) ?? 0;

  if (pbt !== null) {
    return { value: pbt - otherIncome + depreciation + interest, derived: true };
  }

  return { value: null, derived: false };
}

export const RATIOS = [
  { key: "opm", label: "Operating margin %", unit: "%" },
  { key: "npm", label: "Net margin %", unit: "%" },
  { key: "roe", label: "Return on equity %", unit: "%" },
  { key: "roce", label: "Return on capital employed %", unit: "%" },
  { key: "debt_to_equity", label: "Debt to equity", unit: "x" },
  { key: "interest_coverage", label: "Interest coverage", unit: "x" },
] as const;

export type RatioKey = (typeof RATIOS)[number]["key"];

export function computeRatios(
  figures: PeriodFigures,
): Record<RatioKey, number | null> {
  const income = figures.income_statement ?? {};
  const balance = figures.balance_sheet ?? {};

  const equity =
    balance.equity_capital !== null &&
    balance.equity_capital !== undefined &&
    balance.reserves !== null &&
    balance.reserves !== undefined
      ? balance.equity_capital + balance.reserves
      : null;

  const capitalEmployed =
    equity !== null && balance.borrowings !== null && balance.borrowings !== undefined
      ? equity + balance.borrowings
      : null;

  // EBIT: operating profit already excludes interest and tax.
  const ebit = operatingProfit(income).value;

  return {
    opm: percent(ebit, income.revenue ?? null),
    npm: percent(income.net_profit ?? null, income.revenue ?? null),
    roe: percent(income.net_profit ?? null, equity),
    roce: percent(ebit, capitalEmployed),
    debt_to_equity: divide(balance.borrowings ?? null, equity),
    interest_coverage: divide(ebit, income.interest ?? null),
  };
}

/** Year-on-year growth between consecutive periods, oldest first. */
export function growthSeries(rows: FinancialRow[], key: "revenue" | "net_profit") {
  return rows.map((row, index) => {
    const current = row.data.income_statement?.[key] ?? null;
    const previous =
      index > 0 ? (rows[index - 1].data.income_statement?.[key] ?? null) : null;

    return {
      period: row.period_label,
      value: current,
      growth:
        current === null || previous === null || previous === 0
          ? null
          : ((current - previous) / Math.abs(previous)) * 100,
    };
  });
}
