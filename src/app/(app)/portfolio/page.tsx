import { PageHeading, EmptyState } from "@/components/page-heading";
import { AddHoldingForm } from "@/components/add-holding-form";
import { HoldingsTable } from "@/components/holdings-table";
import { RefreshPricesButton } from "@/components/refresh-prices-button";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  currentValue,
  dayMove,
  investedValue,
  portfolioXirr,
  type Holding,
} from "@/types/holding";

/** Kept out of the component body so rendering stays a pure function. */
function currentTime() {
  return new Date();
}

export default async function PortfolioPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("holdings")
    .select(
      "id, symbol, exchange, quantity, avg_price, buy_date, thesis, last_price, previous_close, last_refreshed_at",
    )
    .order("symbol");

  // Postgres returns `numeric` as a string, so convert before doing any maths.
  const holdings: Holding[] = (data ?? []).map((row) => ({
    ...row,
    quantity: Number(row.quantity),
    avg_price: Number(row.avg_price),
    last_price: row.last_price === null ? null : Number(row.last_price),
    previous_close:
      row.previous_close === null ? null : Number(row.previous_close),
  }));

  const totalInvested = holdings.reduce(
    (sum, holding) => sum + investedValue(holding),
    0,
  );

  // Only holdings with a fetched price count towards the current value, so a
  // failed lookup can't silently understate the total.
  const priced = holdings.filter((holding) => holding.last_price !== null);
  const totalCurrent = priced.reduce(
    (sum, holding) => sum + (currentValue(holding) ?? 0),
    0,
  );
  const pricedInvested = priced.reduce(
    (sum, holding) => sum + investedValue(holding),
    0,
  );
  const totalPnl = totalCurrent - pricedInvested;
  const totalPnlPercent =
    pricedInvested === 0 ? 0 : (totalPnl / pricedInvested) * 100;

  // Annualised return, which a total percentage can't give you: 40% over ten
  // months and 40% over eight years are not the same result.
  const annualised = portfolioXirr(holdings, currentTime());

  // Today's move across the portfolio, which the since-you-bought figures hide.
  const moves = holdings.map(dayMove).filter((move) => move !== null);
  const dayAmount = moves.reduce((sum, move) => sum + move.amount, 0);
  const dayBase = holdings.reduce(
    (sum, h) =>
      h.previous_close === null ? sum : sum + h.quantity * h.previous_close,
    0,
  );
  const dayPercent = dayBase === 0 ? null : (dayAmount / dayBase) * 100;

  const lastRefreshedAt =
    holdings
      .map((holding) => holding.last_refreshed_at)
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1) ?? null;

  return (
    <>
      <PageHeading
        title="Portfolio"
        subtitle="Your holdings, entered manually and priced on demand."
        action={
          holdings.length > 0 ? (
            <RefreshPricesButton lastRefreshedAt={lastRefreshedAt} />
          ) : undefined
        }
      />

      <AddHoldingForm />

      <div className="mt-8">
        {error ? (
          <EmptyState
            title="Couldn't load your holdings"
            description={error.message}
          />
        ) : holdings.length === 0 ? (
          <EmptyState
            title="No holdings yet"
            description="Add your first stock using the form above and it will appear here."
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 className="text-base font-medium">
                {holdings.length} holding{holdings.length === 1 ? "" : "s"}
              </h2>
              <div className="flex flex-wrap gap-x-6 text-sm text-muted">
                <span>
                  Invested{" "}
                  <span className="figure text-foreground">
                    {formatCurrency(totalInvested)}
                  </span>
                </span>
                {priced.length > 0 && (
                  <>
                    {dayPercent !== null && (
                      <span>
                        Today{" "}
                        <span
                          className={`figure ${
                            dayAmount >= 0 ? "text-positive" : "text-negative"
                          }`}
                        >
                          {formatCurrency(dayAmount)} ({formatPercent(dayPercent)})
                        </span>
                      </span>
                    )}
                    <span>
                      Value{" "}
                      <span className="figure text-foreground">
                        {formatCurrency(totalCurrent)}
                      </span>
                    </span>
                    <span>
                      P&amp;L{" "}
                      <span
                        className={`figure ${
                          totalPnl >= 0 ? "text-positive" : "text-negative"
                        }`}
                      >
                        {formatCurrency(totalPnl)} (
                        {formatPercent(totalPnlPercent)})
                      </span>
                    </span>
                    {annualised && (
                      <span
                        title={`Across the ${annualised.covered} holding${annualised.covered === 1 ? "" : "s"} that have a buy date and a price.`}
                      >
                        Annualised{" "}
                        <span
                          className={`figure ${
                            annualised.rate >= 0
                              ? "text-positive"
                              : "text-negative"
                          }`}
                        >
                          {formatPercent(annualised.rate)}
                        </span>
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {annualised && annualised.covered < holdings.length && (
              <p className="mb-3 text-xs text-muted">
                Annualised return covers {annualised.covered} of{" "}
                {holdings.length} holdings — the rest have no buy date. Add one
                by editing the holding.
              </p>
            )}

            {!annualised && priced.length > 0 && (
              <p className="mb-3 text-xs text-muted">
                Add a buy date to your holdings to see an annualised return,
                which is what makes gains comparable across positions bought at
                different times.
              </p>
            )}

            {priced.length > 0 && priced.length < holdings.length && (
              <p className="mb-3 text-xs text-muted">
                Totals cover the {priced.length} of {holdings.length} holdings
                that have a price. Refresh again to fill in the rest.
              </p>
            )}

            <HoldingsTable
              holdings={holdings}
              nowIso={currentTime().toISOString()}
            />
          </>
        )}
      </div>
    </>
  );
}
