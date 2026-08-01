/**
 * Grey placeholders shown while a page's data is on its way. They mirror the
 * shape of the real content, so the page doesn't jump when it arrives.
 *
 * `.skeleton` (in globals.css) supplies the colour and the slow pulse, and
 * stops pulsing for anyone who has asked their system to reduce motion.
 */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}

/** A heading and subtitle in the same place as the real PageHeading. */
export function HeadingSkeleton() {
  return (
    <div className="mb-6">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
    </div>
  );
}

/** The row of summary tiles at the top of the dashboard. */
export function TilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-surface px-4 py-3.5 sm:px-5 sm:py-4"
        >
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

/** A card with a title and a few lines of content inside it. */
export function CardSkeleton({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface p-4 sm:p-5 ${className}`}
    >
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton
            key={index}
            className="h-3.5"
            // Ragged widths read as text rather than as a solid block.
            style={{ width: `${92 - index * 11}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Stands in for a table: a header band and a handful of rows. */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border bg-surface-sunken px-4 py-3">
        <Skeleton className="h-2.5 w-28" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-4 border-b border-border px-4 py-3.5 last:border-0"
        >
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}
