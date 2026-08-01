import { CardSkeleton, HeadingSkeleton, Skeleton } from "@/components/skeleton";

/**
 * The stock page waits on a year of price history before it can render, so this
 * stands in with the same shape: a tab bar, the price chart, then the briefing.
 */
export default function StockLoading() {
  return (
    <>
      <HeadingSkeleton />

      <div className="-mx-4 mb-6 flex gap-4 border-b border-border px-4 pb-3 sm:-mx-6 sm:px-6">
        {[64, 76, 88, 108, 40].map((width) => (
          <Skeleton key={width} className="h-3.5" style={{ width }} />
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3 w-56 max-w-full" />
        <Skeleton className="mt-4 h-64 w-full sm:h-72" />
      </div>

      <CardSkeleton className="mt-8" lines={4} />
    </>
  );
}
