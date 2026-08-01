import { fetchPriceHistory, fetchTickerHistory } from "@/lib/prices";
import { rebaseAgainstIndex } from "@/lib/portfolio-analytics";
import { Skeleton } from "@/components/skeleton";
import { IndexComparisonChart } from "@/components/index-comparison-chart";

/** Nifty 50 on Yahoo. Not a tradeable symbol, so it needs the raw fetch. */
const NIFTY = "^NSEI";

/**
 * "Am I beating the index" is the question a rupee total can't answer, and the
 * one most people actually have.
 *
 * One request per holding plus one for the index, so it sits behind a Suspense
 * boundary and the rest of the dashboard never waits for it.
 */
export async function PortfolioVsIndex({
  holdings,
}: {
  holdings: { symbol: string; quantity: number }[];
}) {
  if (holdings.length === 0) return null;

  // Batched so a twenty-stock portfolio doesn't open twenty sockets at once.
  const histories: ({ symbol: string; points: { date: string; close: number }[] } | null)[] =
    [];

  for (let i = 0; i < holdings.length; i += 6) {
    const batch = holdings.slice(i, i + 6);
    const fetched = await Promise.all(
      batch.map(async (holding) => {
        const history = await fetchPriceHistory(holding.symbol, {
          range: "1y",
        }).catch(() => null);
        return history ? { symbol: holding.symbol, points: history.points } : null;
      }),
    );
    histories.push(...fetched);
  }

  const index = await fetchTickerHistory(NIFTY, "1y");
  if (!index) return null;

  const quantityBySymbol = new Map(
    holdings.map((holding) => [holding.symbol, holding.quantity]),
  );

  const usable = histories
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .map((entry) => ({
      quantity: quantityBySymbol.get(entry.symbol) ?? 0,
      points: entry.points,
    }));

  const missing = holdings.length - usable.length;
  const series = rebaseAgainstIndex(usable, index.points);

  if (series.length < 2) return null;

  const last = series[series.length - 1];
  const lead = last.portfolio - last.index;

  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-base font-medium">Against the Nifty 50</h2>
          <p className="mt-0.5 text-xs text-muted">
            Both rebased to 100 on {series[0].date}
          </p>
        </div>

        <p className="text-sm text-muted">
          <span
            className={`figure ${lead >= 0 ? "text-positive" : "text-negative"}`}
          >
            {lead >= 0 ? "+" : ""}
            {lead.toFixed(1)}
          </span>{" "}
          points {lead >= 0 ? "ahead" : "behind"}
        </p>
      </div>

      <IndexComparisonChart series={series} />

      <p className="mt-3 text-xs text-muted">
        Built from today&apos;s quantities applied across the whole year, since
        the app stores one average price per holding rather than a transaction
        history. Anything you bought or sold during the year makes this an
        approximation.
        {missing > 0 &&
          ` ${missing} holding${missing === 1 ? "" : "s"} had no price history and ${missing === 1 ? "is" : "are"} left out.`}
      </p>
    </section>
  );
}

export function PortfolioVsIndexSkeleton() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-52 max-w-full" />
      <Skeleton className="mt-4 h-56 w-full" />
    </section>
  );
}
