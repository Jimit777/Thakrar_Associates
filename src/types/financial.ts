export type FigureMap = Record<string, number | null | undefined>;

export type PeriodFigures = {
  income_statement?: FigureMap;
  balance_sheet?: FigureMap;
  cash_flow?: FigureMap;
};

export type FinancialRow = {
  id: string;
  period_type: "annual" | "quarterly";
  period_label: string;
  basis: "consolidated" | "standalone" | "unknown";
  currency_unit: string | null;
  data: PeriodFigures;
};

/**
 * Rows saved before the balance sheet and cash flow sections existed stored
 * their profit & loss figures flat. Normalise those into the current shape so
 * old and new rows can be displayed together.
 */
export function normaliseFigures(data: unknown): PeriodFigures {
  if (!data || typeof data !== "object") return {};

  const record = data as Record<string, unknown>;
  const hasSections =
    "income_statement" in record ||
    "balance_sheet" in record ||
    "cash_flow" in record;

  if (hasSections) return record as PeriodFigures;

  return { income_statement: record as FigureMap };
}
