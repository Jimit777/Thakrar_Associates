import { periodSortKey } from "@/lib/periods";
import { computeRatios } from "@/lib/ratios";
import type { Valuation } from "@/lib/valuation";
import type { FinancialRow } from "@/types/financial";

/**
 * Five checks on a company, each computed here from confirmed figures — never
 * asked of the AI, and never reduced to a single opaque number.
 *
 * The point is not the verdict. It is that every check shows the figure it used
 * and the threshold it was measured against, so a reader who disagrees with a
 * threshold can see exactly what to discount.
 */

export type Verdict = "strong" | "fair" | "weak" | "unknown";

export type Check = {
  key: string;
  label: string;
  verdict: Verdict;
  /** The measured figure, already formatted. */
  value: string;
  /**
   * What the figure actually is, in a few words — "operating cash ÷ net
   * profit". A heading alone can't carry both the plain-English name and the
   * calculation, and the reader needs both.
   */
  measure: string;
  /** Which periods and which figures it came from. */
  basis: string;
  /** The bands the figure was judged against. */
  thresholds: string;
};

export type Scorecard = {
  checks: Check[];
  strong: number;
  /** How many checks had enough data to be judged at all. */
  judged: number;
};

const num = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Higher is better: fails below `weak`, strong at or above `strong`. */
function band(value: number | null, weak: number, strong: number): Verdict {
  if (value === null) return "unknown";
  if (value >= strong) return "strong";
  if (value >= weak) return "fair";
  return "weak";
}

/** Lower is better — debt, and the price you pay. */
function inverseBand(value: number | null, strong: number, weak: number): Verdict {
  if (value === null) return "unknown";
  if (value <= strong) return "strong";
  if (value <= weak) return "fair";
  return "weak";
}

const pct = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}%`;
const times = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(2)}×`;

/** Fiscal year number behind a period label, for measuring elapsed years. */
function fiscalYear(label: string) {
  const key = periodSortKey(label);
  return key === null ? null : Math.floor(key / 10);
}

export function buildScorecard(
  rows: FinancialRow[],
  valuation: Valuation | null,
): Scorecard | null {
  // Prefer consolidated, and fall back to whatever basis the user has saved.
  const annual = rows.filter((row) => row.period_type === "annual");
  const consolidated = annual.filter((row) => row.basis === "consolidated");
  const pool = consolidated.length > 0 ? consolidated : annual;

  if (pool.length === 0) return null;

  const latest = pool[pool.length - 1];
  const earliest = pool[0];
  const latestRatios = computeRatios(latest.data);

  const checks: Check[] = [];

  // 1. Growth — compound annual revenue growth across everything saved.
  const startRevenue = num(earliest.data.income_statement?.revenue);
  const endRevenue = num(latest.data.income_statement?.revenue);
  const startYear = fiscalYear(earliest.period_label);
  const endYear = fiscalYear(latest.period_label);
  const years =
    startYear !== null && endYear !== null ? endYear - startYear : null;

  let cagr: number | null = null;
  if (
    startRevenue !== null &&
    endRevenue !== null &&
    startRevenue > 0 &&
    endRevenue > 0 &&
    years !== null &&
    years > 0
  ) {
    cagr = ((endRevenue / startRevenue) ** (1 / years) - 1) * 100;
  }

  checks.push({
    key: "growth",
    label: "Sales growth",
    verdict: band(cagr, 5, 12),
    value: pct(cagr),
    measure: "a year, compounded",
    basis:
      cagr === null
        ? "Needs revenue in two annual periods at least a year apart."
        : `Revenue compounded from ${earliest.period_label} to ${latest.period_label}, ${years} year${years === 1 ? "" : "s"}.`,
    thresholds: "Strong ≥ 12% a year · Fair 5–12% · Weak below 5%",
  });

  // 2. Profitability — return on capital employed, the cleanest single measure
  //    of whether the business earns more than the money tied up in it.
  const roce = latestRatios.roce;
  checks.push({
    key: "profitability",
    label: "Return on capital",
    verdict: band(roce, 10, 15),
    value: pct(roce),
    measure: "operating profit ÷ capital used",
    basis:
      roce === null
        ? "Needs operating profit plus equity and borrowings from the balance sheet."
        : `Return on capital employed in ${latest.period_label}.`,
    thresholds: "Strong ≥ 15% · Fair 10–15% · Weak below 10%",
  });

  // 3. Balance sheet — how much of the business is borrowed.
  const debtToEquity = latestRatios.debt_to_equity;
  const coverage = latestRatios.interest_coverage;
  checks.push({
    key: "balance_sheet",
    label: "Debt vs equity",
    verdict: inverseBand(debtToEquity, 0.5, 1),
    value: times(debtToEquity),
    measure: "borrowings ÷ shareholders' funds",
    basis:
      debtToEquity === null
        ? "Needs borrowings, equity capital and reserves from the balance sheet."
        : `Borrowings against equity in ${latest.period_label}` +
          (coverage === null
            ? "."
            : `. Operating profit covers interest ${coverage.toFixed(1)}×.`),
    thresholds: "Strong ≤ 0.5× · Fair 0.5–1× · Weak above 1×",
  });

  // 4. Cash conversion — profit that never arrives as cash is an accounting
  //    entry. Averaged over the saved years so one odd year doesn't decide it.
  const conversions = pool
    .map((row) => {
      const profit = num(row.data.income_statement?.net_profit);
      const operating = num(row.data.cash_flow?.cash_from_operating);
      return profit !== null && profit > 0 && operating !== null
        ? operating / profit
        : null;
    })
    .filter((value): value is number => value !== null);

  const conversion =
    conversions.length > 0
      ? conversions.reduce((sum, value) => sum + value, 0) / conversions.length
      : null;

  checks.push({
    key: "cash",
    label: "Profit into cash",
    verdict: band(conversion, 0.5, 0.8),
    value: conversion === null ? "—" : `${conversion.toFixed(2)}×`,
    measure: "operating cash ÷ net profit",
    basis:
      conversion === null
        ? "Needs a cash flow statement alongside net profit — quarterly filings rarely carry one."
        : `Cash from operations against net profit, averaged over ${conversions.length} year${conversions.length === 1 ? "" : "s"}.`,
    thresholds: "Strong ≥ 0.8× · Fair 0.5–0.8× · Weak below 0.5×",
  });

  // 5. What the market is charging for it. A fair multiple genuinely depends on
  //    the industry, so the bands are deliberately wide and stated plainly.
  const pe = valuation?.peRatio ?? null;
  checks.push({
    key: "valuation",
    label: "Price vs profit",
    verdict: inverseBand(pe, 20, 40),
    value: pe === null ? "—" : `${pe.toFixed(1)}×`,
    measure: "P/E — share price ÷ earnings per share",
    basis:
      pe === null
        ? "Needs a share price and the EPS printed in the annual report."
        : `Share price against ${valuation?.periodLabel} earnings per share.`,
    thresholds:
      "Cheap ≤ 20× · Full 20–40× · Expensive above 40×. A fair multiple varies by industry — treat this as the crudest of the five.",
  });

  return {
    checks,
    strong: checks.filter((check) => check.verdict === "strong").length,
    judged: checks.filter((check) => check.verdict !== "unknown").length,
  };
}
