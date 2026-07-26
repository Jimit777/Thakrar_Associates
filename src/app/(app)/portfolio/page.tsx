import { PageHeading, EmptyState } from "@/components/page-heading";
import { AddHoldingForm } from "@/components/add-holding-form";
import { HoldingsTable } from "@/components/holdings-table";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import { investedValue, type Holding } from "@/types/holding";

export default async function PortfolioPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("holdings")
    .select("id, symbol, exchange, quantity, avg_price, buy_date, last_price, last_refreshed_at")
    .order("symbol");

  // Postgres returns `numeric` as a string, so convert before doing any maths.
  const holdings: Holding[] = (data ?? []).map((row) => ({
    ...row,
    quantity: Number(row.quantity),
    avg_price: Number(row.avg_price),
    last_price: row.last_price === null ? null : Number(row.last_price),
  }));

  const totalInvested = holdings.reduce(
    (sum, holding) => sum + investedValue(holding),
    0,
  );

  return (
    <>
      <PageHeading
        title="Portfolio"
        subtitle="Your holdings, entered manually and priced on demand."
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
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-medium">
                {holdings.length} holding{holdings.length === 1 ? "" : "s"}
              </h2>
              <p className="text-sm text-muted">
                Total invested{" "}
                <span className="figure text-foreground">
                  {formatCurrency(totalInvested)}
                </span>
              </p>
            </div>
            <HoldingsTable holdings={holdings} />
          </>
        )}
      </div>
    </>
  );
}
