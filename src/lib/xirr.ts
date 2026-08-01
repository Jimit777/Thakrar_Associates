/**
 * Annualised return that accounts for *when* money went in.
 *
 * "Up 40%" says nothing without a period: 40% over ten months is excellent and
 * 40% over eight years is worse than a fixed deposit. XIRR is the rate that
 * makes a set of dated cash flows sum to zero — the same figure a broker's
 * console reports.
 */

export type CashFlow = {
  /** Negative for money put in, positive for money coming back or still held. */
  amount: number;
  date: Date;
};

const DAYS_PER_YEAR = 365;

function netPresentValue(flows: CashFlow[], rate: number, start: Date) {
  let total = 0;

  for (const flow of flows) {
    const years =
      (flow.date.getTime() - start.getTime()) / (DAYS_PER_YEAR * 86_400_000);
    total += flow.amount / (1 + rate) ** years;
  }

  return total;
}

/**
 * Returns the annualised rate as a percentage, or null when the flows can't
 * produce one — all the same sign, a single date, or no convergence.
 *
 * Bisection rather than Newton-Raphson: it is slower but cannot diverge, and a
 * portfolio down 90% sits near the edge where Newton's method wanders off.
 */
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null;

  const hasInflow = flows.some((flow) => flow.amount > 0);
  const hasOutflow = flows.some((flow) => flow.amount < 0);
  if (!hasInflow || !hasOutflow) return null;

  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const start = sorted[0].date;
  const end = sorted[sorted.length - 1].date;

  // Everything on one day has no period to annualise over.
  if (end.getTime() - start.getTime() < 86_400_000) return null;

  // −99.99% to +100,000% a year covers anything a portfolio can realistically do.
  let low = -0.9999;
  let high = 1000;

  let lowValue = netPresentValue(sorted, low, start);
  let highValue = netPresentValue(sorted, high, start);

  // No sign change means no root inside the bracket.
  if (lowValue * highValue > 0) return null;

  for (let step = 0; step < 200; step++) {
    const mid = (low + high) / 2;
    const midValue = netPresentValue(sorted, mid, start);

    if (Math.abs(midValue) < 1e-7 || high - low < 1e-9) {
      return mid * 100;
    }

    if (lowValue * midValue < 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }

  return ((low + high) / 2) * 100;
}

/** Whole days between two dates. */
export function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** "2 years 4 months", "8 months", "19 days" — however long is worth saying. */
export function formatHoldingPeriod(days: number) {
  if (days < 45) return `${days} day${days === 1 ? "" : "s"}`;

  const months = Math.round(days / 30.44);
  if (months < 18) return `${months} month${months === 1 ? "" : "s"}`;

  const years = Math.floor(months / 12);
  const remainder = months % 12;

  return remainder === 0
    ? `${years} year${years === 1 ? "" : "s"}`
    : `${years} year${years === 1 ? "" : "s"} ${remainder} month${remainder === 1 ? "" : "s"}`;
}
