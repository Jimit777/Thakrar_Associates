import Link from "next/link";
import { PageHeading, EmptyState } from "@/components/page-heading";
import { AddStockForm } from "@/components/add-stock-form";
import { createClient } from "@/lib/supabase/server";
import type { Stock } from "@/types/stock";

export default async function AnalyzerPage() {
  const supabase = await createClient();

  const [{ data, error }, { data: holdings }] = await Promise.all([
    supabase
      .from("stocks")
      .select("id, symbol, name, sector, documents(count)")
      .order("symbol"),
    supabase.from("holdings").select("symbol"),
  ]);

  type Row = Stock & { documents: { count: number }[] };
  const stocks = (data ?? []) as Row[];

  // Which of these you actually own. The two lists have always been separate —
  // stocks are what you research, holdings are what you hold — but nothing on
  // this page said which was which.
  const held = new Set((holdings ?? []).map((row) => row.symbol as string));

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
                  className="rounded-lg border border-border bg-surface p-4 sm:p-5 transition-colors hover:border-accent"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-medium">{stock.symbol}</h2>
                    {held.has(stock.symbol) ? (
                      <span className="rounded-full border border-accent/40 bg-accent-tint px-2 py-0.5 text-[11px] text-accent">
                        Held
                      </span>
                    ) : (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                        Watching
                      </span>
                    )}
                  </div>
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
