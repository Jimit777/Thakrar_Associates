export type Exchange = "NSE" | "BSE";

export type Holding = {
  id: string;
  symbol: string;
  exchange: Exchange;
  quantity: number;
  avg_price: number;
  buy_date: string | null;
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
