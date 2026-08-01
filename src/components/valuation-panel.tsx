import { formatRupeeScale } from "@/lib/units";
import type { Valuation } from "@/lib/valuation";

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div>
      <dt className="stat-label">{label}</dt>
      <dd className="figure mt-0.5 text-base">{value}</dd>
      {note && <dd className="text-[11px] text-muted">{note}</dd>}
    </div>
  );
}

/**
 * What the market is charging for the earnings and assets in the reports.
 *
 * P/E works from the EPS the report printed, so it needs no share count. The
 * rest need one, and quietly show a dash until it has been extracted.
 */
export function ValuationPanel({ valuation }: { valuation: Valuation }) {
  const missingShares = valuation.sharesOutstanding === null;

  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-medium">Valuation</h2>
        <p className="text-xs text-muted">
          Last price against {valuation.periodLabel}
          {valuation.basis === "unknown" ? "" : ` ${valuation.basis}`} figures
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        <Metric
          label="Price"
          value={new Intl.NumberFormat("en-IN", {
            maximumFractionDigits: 2,
          }).format(valuation.price)}
        />
        <Metric
          label="Market cap"
          value={
            valuation.marketCap === null
              ? "—"
              : formatRupeeScale(valuation.marketCap)
          }
        />
        <Metric
          label="P / E"
          value={
            valuation.peRatio === null ? "—" : `${valuation.peRatio.toFixed(1)}×`
          }
          note="on reported EPS"
        />
        <Metric
          label="P / B"
          value={
            valuation.pbRatio === null ? "—" : `${valuation.pbRatio.toFixed(2)}×`
          }
        />
        <Metric
          label="P / Sales"
          value={
            valuation.priceToSales === null
              ? "—"
              : `${valuation.priceToSales.toFixed(2)}×`
          }
        />
        <Metric
          label="Earnings yield"
          value={
            valuation.earningsYield === null
              ? "—"
              : `${valuation.earningsYield.toFixed(2)}%`
          }
        />
      </dl>

      {valuation.shareCountWarning && (
        <p className="mt-4 rounded-md border border-negative/40 bg-surface-sunken p-3 text-sm">
          <span className="stat-label text-negative">Check the share count</span>
          <br />
          <span className="text-muted">{valuation.shareCountWarning}</span>
        </p>
      )}

      {missingShares && (
        <p className="mt-4 rounded-md border border-border bg-surface-sunken p-3 text-sm text-muted">
          Market cap, book value and price-to-sales need the number of equity
          shares outstanding. Re-extract an annual report to pick it up from the
          share capital note — P/E above works without it.
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        Built from the last annual period you confirmed, not a trailing twelve
        months. If the company has reported since, these are behind.
      </p>
    </section>
  );
}
