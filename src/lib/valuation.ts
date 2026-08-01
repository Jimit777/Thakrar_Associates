import { unitMultiplier } from "@/lib/units";
import type { FinancialRow } from "@/types/financial";

/**
 * Valuation joins two things the app already holds separately: the share price
 * from the chart, and the confirmed figures from the reports.
 *
 * Everything here is plain arithmetic on those two inputs. Where a figure is
 * missing the metric comes back null rather than being estimated, and every
 * metric records which period it was built from so the page can say so.
 */

export type Valuation = {
  price: number;
  /** The annual period these ratios were built from. */
  periodLabel: string;
  basis: FinancialRow["basis"];
  marketCap: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  priceToSales: number | null;
  earningsYield: number | null;
  bookValuePerShare: number | null;
  sharesOutstanding: number | null;
  /**
   * Set when the reported EPS and the EPS implied by net profit ÷ shares
   * disagree badly — usually a share count read in crore rather than as a count.
   */
  shareCountWarning: string | null;
};

const num = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function divide(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/**
 * Builds valuation ratios from the most recent annual period.
 *
 * Annual rather than trailing twelve months: the app only holds the periods the
 * user has uploaded, and stitching four quarters together silently produces a
 * wrong answer whenever one of them is missing.
 */
export function computeValuation(
  rows: FinancialRow[],
  price: number | null,
): Valuation | null {
  if (price === null || !Number.isFinite(price) || price <= 0) return null;

  const annual = rows.filter((row) => row.period_type === "annual");
  if (annual.length === 0) return null;

  // Prefer consolidated: it is the whole group, which is what the market prices.
  const consolidated = annual.filter((row) => row.basis === "consolidated");
  const pool = consolidated.length > 0 ? consolidated : annual;
  const latest = pool[pool.length - 1];

  const multiplier = unitMultiplier(latest.currency_unit);
  const income = latest.data.income_statement ?? {};
  const balance = latest.data.balance_sheet ?? {};

  const eps = num(income.eps);
  const netProfit = num(income.net_profit);
  const revenue = num(income.revenue);
  const shares = num(latest.data.shares_outstanding);

  const equity =
    num(balance.equity_capital) !== null && num(balance.reserves) !== null
      ? num(balance.equity_capital)! + num(balance.reserves)!
      : null;

  // Rupee amounts, only where the reported unit was one we recognise.
  const toRupees = (value: number | null) =>
    value === null || multiplier === null ? null : value * multiplier;

  const marketCap = shares === null ? null : price * shares;
  const bookValuePerShare = divide(toRupees(equity), shares);

  // The share count is the figure most likely to come back in the wrong scale,
  // and it is easy to check: net profit divided by shares should be the EPS the
  // report printed.
  let shareCountWarning: string | null = null;
  const impliedEps = divide(toRupees(netProfit), shares);

  if (eps !== null && impliedEps !== null && eps !== 0) {
    const ratio = impliedEps / eps;
    if (ratio > 1.25 || ratio < 0.8) {
      shareCountWarning =
        `Net profit divided by the share count gives EPS of ${impliedEps.toFixed(2)}, ` +
        `but the report prints ${eps.toFixed(2)}. The share count is probably in the ` +
        `wrong scale — re-extract and correct it before trusting market cap or book value.`;
    }
  }

  return {
    price,
    periodLabel: latest.period_label,
    basis: latest.basis,
    marketCap,
    peRatio: eps === null || eps <= 0 ? null : price / eps,
    pbRatio: divide(price, bookValuePerShare),
    priceToSales: divide(marketCap, toRupees(revenue)),
    earningsYield: eps === null ? null : (eps / price) * 100,
    bookValuePerShare,
    sharesOutstanding: shares,
    shareCountWarning,
  };
}
