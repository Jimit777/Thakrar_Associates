import Link from "next/link";
import { PageHeading, EmptyState } from "@/components/page-heading";
import { AddStockForm } from "@/components/add-stock-form";
import { createClient } from "@/lib/supabase/server";
import type { Stock } from "@/types/stock";

export default async function AnalyzerPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stocks")
    .select("id, symbol, name, sector, documents(count)")
    .order("symbol");

  type Row = Stock & { documents: { count: number }[] };
  const stocks = (data ?? []) as Row[];

  return (
    <>
      <PageHeading
        title="Analyzer"
        subtitle="Upload company reports, then review the figures pulled from them."
      />

      <AddStockForm />

      <div className="mt-8">
        {error ? (
          <EmptyState title="Couldn't load your stocks" description={error.message} />
        ) : stocks.length === 0 ? (
          <EmptyState
            title="No stocks yet"
            description="Add a stock above, then upload its annual and quarterly reports."
          />
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stocks.map((stock) => {
              const documentCount = stock.documents?.[0]?.count ?? 0;

              return (
                <Link
                  key={stock.id}
                  href={`/analyzer/${stock.symbol}`}
                  className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent"
                >
                  <h2 className="text-lg font-medium">{stock.symbol}</h2>
                  {stock.name && (
                    <p className="mt-1 text-sm text-muted">{stock.name}</p>
                  )}
                  <p className="mt-3 text-xs text-muted">
                    {documentCount} document{documentCount === 1 ? "" : "s"}
                    {stock.sector ? ` · ${stock.sector}` : ""}
                  </p>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </>
  );
}
