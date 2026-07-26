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
