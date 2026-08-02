import { formatCurrency } from "@/lib/format";
import { ClassifySectorsButton } from "@/components/classify-sectors-button";
import type { Concentration, SectorSlice } from "@/lib/portfolio-analytics";

/*
 * Distinct in hue and in lightness, so the bars stay separable for a reader
 * with colour vision deficiency. Clay first, matching the rest of the app.
 */
const PALETTE = [
  "#A9502F",
  "#0072B2",
  "#7E22CE",
  "#0F766E",
  "#334155",
  "#BE185D",
  "#92400E",
];

/**
 * Where the money actually sits. A total tells you how much you have; this
 * tells you how much of it depends on the same thing happening.
 */
export function SectorAllocation({
  sectors,
  flags,
  unclassified,
}: {
  sectors: SectorSlice[];
  flags: Concentration[];
  /** Symbols with no sector set, which the user has to fill in themselves. */
  unclassified: string[];
}) {
  if (sectors.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-base font-medium">Where your money sits</h2>
          <p className="mt-0.5 text-xs text-muted">
            By sector, at the last refreshed prices
          </p>
        </div>

        {unclassified.length > 0 && (
          <div className="text-right">
            <ClassifySectorsButton count={unclassified.length} />
          </div>
        )}
      </div>

      {/* One stacked bar first: the shape of the portfolio in a single glance,
          before any of the numbers. */}
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-sunken">
        {sectors.map((slice, index) => (
          <div
            key={slice.sector}
            style={{
              width: `${slice.percent}%`,
              background: PALETTE[index % PALETTE.length],
            }}
            title={`${slice.sector} ${slice.percent.toFixed(1)}%`}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2.5">
        {sectors.map((slice, index) => (
          <li
            key={slice.sector}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: PALETTE[index % PALETTE.length] }}
                aria-hidden
              />
              {slice.sector}
              <span className="text-xs text-muted">
                {slice.symbols.join(", ")}
              </span>
            </span>
            <span className="figure text-muted">
              {formatCurrency(slice.value)}
              <span className="ml-2 text-foreground">
                {slice.percent.toFixed(1)}%
              </span>
            </span>
          </li>
        ))}
      </ul>

      {flags.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-3">
          {flags.map((flag) => (
            <li key={flag.kind} className="text-sm text-secondary">
              {flag.message}
            </li>
          ))}
        </ul>
      )}

      {unclassified.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          No sector yet for {unclassified.join(", ")}. Classifying works them all
          out in one go and remembers each company, so it is paid for once.
        </p>
      )}
    </section>
  );
}
