import { PriceChart } from "@/components/price-chart";
import { ScorecardPanel } from "@/components/scorecard-panel";
import { ValuationPanel } from "@/components/valuation-panel";
import { Skeleton } from "@/components/skeleton";
import { getPriceHistory } from "@/app/(app)/analyzer/price";
import { buildScorecard } from "@/lib/scorecard";
import { computeValuation } from "@/lib/valuation";
import type { FinancialRow } from "@/types/financial";

/**
 * Everything that depends on the share price, fetched in one place.
 *
 * Kept apart from the rest of the page so it can sit behind a Suspense
 * boundary: the price comes from Yahoo over the network, and waiting on it was
 * holding up the whole stock page — key points, financials, the chat, all of it
 * blocked on a chart the reader may not even scroll to.
 */
export async function PriceAndValuation({
  symbol,
  financials,
}: {
  symbol: string;
  financials: FinancialRow[];
}) {
  const prices = await getPriceHistory(symbol, { range: "1y" });

  const lastPrice = prices.ok ? (prices.history.points.at(-1)?.close ?? null) : null;
  const valuation = computeValuation(financials, lastPrice);
  const scorecard = buildScorecard(financials, valuation);

  return (
    <div className="space-y-8">
      {scorecard && <ScorecardPanel scorecard={scorecard} />}
      {valuation && <ValuationPanel valuation={valuation} />}

      <PriceChart
        symbol={symbol}
        initialHistory={prices.ok ? prices.history : null}
        initialError={prices.ok ? null : prices.error}
      />

    </div>
  );
}

/** Holds the same space while the price is in flight. */
export function PriceAndValuationSkeleton() {
  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <Skeleton className="h-4 w-28" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-3 w-56 max-w-full" />
        <Skeleton className="mt-4 h-64 w-full sm:h-72" />
      </div>
    </div>
  );
}
