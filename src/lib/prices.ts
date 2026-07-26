import type { Exchange } from "@/types/holding";

export type Quote = {
  price: number;
  currency: string;
  name: string | null;
};

/**
 * Yahoo tickers carry an exchange suffix: RELIANCE.NS for NSE, RELIANCE.BO
 * for BSE.
 */
function yahooTicker(symbol: string, exchange: Exchange) {
  return `${symbol}${exchange === "BSE" ? ".BO" : ".NS"}`;
}

/**
 * Looks up the latest traded price for one stock.
 *
 * This is Yahoo's public chart endpoint — not a contracted API, so it can
 * change or rate-limit without notice. Every caller must handle `null`.
 */
export async function fetchQuote(
  symbol: string,
  exchange: Exchange,
): Promise<Quote | null> {
  const ticker = yahooTicker(symbol, exchange);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=1d&range=1d`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;

    const json = await response.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;

    if (typeof price !== "number" || !Number.isFinite(price)) return null;

    return {
      price,
      currency: meta.currency ?? "INR",
      name: meta.shortName ?? meta.longName ?? null,
    };
  } catch {
    // Network error, timeout, or unexpected response shape.
    return null;
  }
}

export type PricePoint = { date: string; close: number };

export type PriceHistory = {
  ticker: string;
  points: PricePoint[];
};

/**
 * Fewer, wider candles on long ranges keeps the payload sensible without
 * flattening the shape of the chart. Weekly holds up to about a decade
 * (~520 points); only multi-decade ranges need monthly.
 */
function intervalForSpan(days: number) {
  if (days <= 400) return "1d";
  if (days <= 3800) return "1wk";
  return "1mo";
}

export const PRICE_RANGES = [
  { id: "1mo", label: "1M", days: 31 },
  { id: "3mo", label: "3M", days: 92 },
  { id: "6mo", label: "6M", days: 183 },
  { id: "1y", label: "1Y", days: 365 },
  { id: "5y", label: "5Y", days: 1826 },
  { id: "10y", label: "10Y", days: 3653 },
  { id: "max", label: "Max", days: 20000 },
] as const;

export type PriceRangeId = (typeof PRICE_RANGES)[number]["id"];

async function fetchChart(ticker: string, query: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${query}`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) return null;

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  const timestamps: number[] | undefined = result?.timestamp;
  const closes: (number | null)[] | undefined =
    result?.indicators?.quote?.[0]?.close;

  if (!timestamps || !closes) return null;

  const points: PricePoint[] = [];
  timestamps.forEach((seconds, index) => {
    const close = closes[index];
    if (typeof close === "number" && Number.isFinite(close)) {
      points.push({
        date: new Date(seconds * 1000).toISOString().slice(0, 10),
        close,
      });
    }
  });

  return points.length > 0 ? points : null;
}

function spanOf(points: PricePoint[]) {
  if (points.length < 2) return 0;
  return (
    new Date(points[points.length - 1].date).getTime() -
    new Date(points[0].date).getTime()
  );
}

/**
 * Closing prices for a stock, either over a preset range or between two dates.
 *
 * Both exchanges are queried, because a stock's listing history can differ
 * between them — a company that moved to NSE recently may have years more data
 * on BSE. Taking whichever answered first would silently show one year of NSE
 * data for a ten-year request, so the longer history wins, with NSE preferred
 * when the two are comparable.
 */
export async function fetchPriceHistory(
  symbol: string,
  selection: { range: PriceRangeId } | { from: string; to: string },
): Promise<PriceHistory | null> {
  let query: string;

  if ("range" in selection) {
    const preset = PRICE_RANGES.find((entry) => entry.id === selection.range);
    query = `range=${selection.range}&interval=${intervalForSpan(preset?.days ?? 365)}`;
  } else {
    const from = Math.floor(new Date(selection.from).getTime() / 1000);
    const to = Math.floor(new Date(selection.to).getTime() / 1000);
    const days = (to - from) / 86_400;
    query = `period1=${from}&period2=${to}&interval=${intervalForSpan(days)}`;
  }

  const [nse, bse] = await Promise.all(
    [".NS", ".BO"].map(async (suffix) => {
      try {
        const ticker = `${symbol}${suffix}`;
        const points = await fetchChart(ticker, query);
        return points ? { ticker, points } : null;
      } catch {
        return null;
      }
    }),
  );

  if (!nse) return bse;
  if (!bse) return nse;

  // Prefer NSE unless BSE covers meaningfully more time (>10% longer).
  return spanOf(bse.points) > spanOf(nse.points) * 1.1 ? bse : nse;
}

/**
 * Looks up several stocks at once, a few at a time so we don't fire off
 * dozens of simultaneous requests.
 */
export async function fetchQuotes(
  items: { symbol: string; exchange: Exchange }[],
  batchSize = 6,
): Promise<Map<string, Quote>> {
  const results = new Map<string, Quote>();

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const quotes = await Promise.all(
      batch.map((item) => fetchQuote(item.symbol, item.exchange)),
    );

    batch.forEach((item, index) => {
      const quote = quotes[index];
      if (quote) results.set(`${item.symbol}:${item.exchange}`, quote);
    });
  }

  return results;
}
