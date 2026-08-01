import { daysBetween, xirr } from "@/lib/xirr";

export type Exchange = "NSE" | "BSE";

export type Holding = {
  id: string;
  symbol: string;
  exchange: Exchange;
  quantity: number;
  avg_price: number;
  buy_date: string | null;
  thesis: string | null;
  last_price: number | null;
  last_refreshed_at: string | null;
};

/** What the user paid in total for a holding. */
export function investedValue(holding: Holding) {
  return holding.quantity * holding.avg_price;
}

/** What the holding is worth at the last refreshed price, if there is one. */
export function currentValue(holding: Holding) {
  return holding.last_price === null ? null : holding.quantity * holding.last_price;
}

/** Profit or loss in rupees, and as a percentage of the amount invested. */
export function profitAndLoss(holding: Holding) {
  const current = currentValue(holding);
  if (current === null) return null;

  const invested = investedValue(holding);
  const amount = current - invested;

  return {
    amount,
    percent: invested === 0 ? 0 : (amount / invested) * 100,
  };
}

/**
 * Annualised return and how long the position has been held.
 *
 * Needs a buy date: without one there is no period to annualise over, and a
 * total percentage on its own can't be compared between holdings bought years
 * apart. Returns null rather than assuming a date.
 */
export function annualisedReturn(holding: Holding, now: Date) {
  const current = currentValue(holding);
  if (current === null || holding.buy_date === null) return null;

  const bought = new Date(`${holding.buy_date}T00:00:00Z`);
  if (Number.isNaN(bought.getTime())) return null;

  const days = daysBetween(bought, now);
  if (days < 1) return null;

  const rate = xirr([
    { amount: -investedValue(holding), date: bought },
    { amount: current, date: now },
  ]);

  return rate === null ? null : { rate, days };
}

/**
 * Portfolio-wide annualised return. Each holding's purchase is one dated
 * outflow and its value today is one inflow, so a stock bought last month
 * doesn't get credit for a rate it hasn't had time to earn.
 *
 * Holdings without a buy date or without a price are left out entirely rather
 * than folded in at a guessed date.
 */
export function portfolioXirr(holdings: Holding[], now: Date) {
  const flows = [];
  let covered = 0;
  let value = 0;

  for (const holding of holdings) {
    const current = currentValue(holding);
    if (current === null || holding.buy_date === null) continue;

    const bought = new Date(`${holding.buy_date}T00:00:00Z`);
    if (Number.isNaN(bought.getTime()) || bought >= now) continue;

    flows.push({ amount: -investedValue(holding), date: bought });
    value += current;
    covered += 1;
  }

  if (covered === 0) return null;

  flows.push({ amount: value, date: now });
  const rate = xirr(flows);

  return rate === null ? null : { rate, covered };
}
