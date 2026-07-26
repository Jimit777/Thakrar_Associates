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
