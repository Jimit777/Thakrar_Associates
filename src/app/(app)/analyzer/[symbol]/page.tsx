import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, EmptyState } from "@/components/page-heading";
import { DocumentUpload } from "@/components/document-upload";
import { DocumentsTable } from "@/components/documents-table";
import { PriceChart } from "@/components/price-chart";
import { StockChat, type ChatMessage } from "@/components/stock-chat";
import { StockTabs } from "@/components/stock-tabs";
import { StockInsights } from "@/components/stock-insights";
import {
  ConcallSummaries,
  type ConcallEntry,
} from "@/components/concall-summaries";
import type { Insights } from "@/lib/insights-schema";
import type { ConcallSummary } from "@/lib/concall-schema";
import { SavedFinancials } from "@/components/saved-financials";
import { createClient } from "@/lib/supabase/server";
import { deleteStock } from "../actions";
import { getPriceHistory } from "../price";
import { sortByPeriod } from "@/lib/periods";
import { type StockDocument, type Stock } from "@/types/stock";
import { normaliseFigures, type FinancialRow } from "@/types/financial";

// Reading a long report can take a few minutes, so allow for it.
export const maxDuration = 300;

export default async function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: stock } = await supabase
    .from("stocks")
    .select("id, symbol, name, sector")
    .eq("symbol", decodeURIComponent(symbol).toUpperCase())
    .maybeSingle<Stock>();

  if (!stock || !user) notFound();

  const { data } = await supabase
    .from("documents")
    .select(
      "id, stock_id, kind, period_label, storage_path, file_name, file_size_bytes, created_at",
    )
    .eq("stock_id", stock.id)
    .order("created_at", { ascending: false });

  const documents = (data ?? []) as StockDocument[];

  const { data: financialsData } = await supabase
    .from("financials")
    .select("id, period_type, period_label, basis, currency_unit, data")
    .eq("stock_id", stock.id)
    .order("period_label");

  // Fetched here so the chart arrives with the page rather than after it.
  const initialPrices = await getPriceHistory(stock.symbol, { range: "1y" });

  const { data: chatData } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("stock_id", stock.id)
    .order("created_at");

  const chatMessages = (chatData ?? []) as ChatMessage[];

  const { data: concallRows } = await supabase
    .from("concall_summaries")
    .select("document_id, content, generated_at")
    .eq("stock_id", stock.id);

  const summaryByDocument = new Map(
    (concallRows ?? []).map((row) => [
      row.document_id as string,
      row as { content: unknown; generated_at: string },
    ]),
  );

  const concallEntries: ConcallEntry[] = documents
    .filter((doc) => doc.kind === "concall")
    .map((doc) => {
      const saved = summaryByDocument.get(doc.id);
      return {
        documentId: doc.id,
        periodLabel: doc.period_label,
        fileName: doc.file_name,
        summary: (saved?.content as ConcallSummary | undefined) ?? null,
        generatedAt: saved?.generated_at ?? null,
      };
    });

  const { data: insightsRow } = await supabase
    .from("stock_insights")
    .select("content, generated_at, periods_used")
    .eq("stock_id", stock.id)
    .maybeSingle<{
      content: unknown;
      generated_at: string;
      periods_used: number;
    }>();

  // Sorted by real chronology, not by label text — otherwise Q1 FY2026 lands
  // before Q2 FY2025.
  const financials: FinancialRow[] = sortByPeriod(
    (financialsData ?? []).map((row) => ({
      ...(row as FinancialRow),
      data: normaliseFigures((row as { data: unknown }).data),
    })),
  );

  return (
    <>
      <PageHeading
        title={stock.symbol}
        subtitle={
          [stock.name, stock.sector].filter(Boolean).join(" · ") ||
          "Uploaded reports for this stock."
        }
        action={
          <div className="flex items-center gap-3">
            <Link
              href="/analyzer"
              className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent"
            >
              All stocks
            </Link>
            <form action={deleteStock}>
              <input type="hidden" name="id" value={stock.id} />
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-negative hover:text-negative"
              >
                Remove
              </button>
            </form>
          </div>
        }
      />

      <StockTabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            panel: (
              <div className="space-y-8">
                <PriceChart
                  symbol={stock.symbol}
                  initialHistory={initialPrices.ok ? initialPrices.history : null}
                  initialError={initialPrices.ok ? null : initialPrices.error}
                />

                <StockInsights
                  stockId={stock.id}
                  symbol={stock.symbol}
                  insights={(insightsRow?.content as Insights | undefined) ?? null}
                  generatedAt={insightsRow?.generated_at ?? null}
                  periodsUsed={insightsRow?.periods_used ?? 0}
                  currentPeriods={financials.length}
                />
              </div>
            ),
          },
          {
            id: "financials",
            label: "Financials",
            count: financials.length,
            panel:
              financials.length === 0 ? (
                <EmptyState
                  title="No figures yet"
                  description="Upload a report under Documents, then extract its figures and confirm them."
                />
              ) : (
                <SavedFinancials rows={financials} />
              ),
          },
          {
            id: "documents",
            label: "Documents",
            count: documents.length,
            panel: (
              <div className="space-y-8">
                <DocumentUpload stockId={stock.id} userId={user.id} />
                {documents.length === 0 ? (
                  <EmptyState
                    title="No documents yet"
                    description="Upload an annual report or quarterly result above. Reading the figures out of them comes next."
                  />
                ) : (
                  <DocumentsTable documents={documents} stockId={stock.id} />
                )}
              </div>
            ),
          },
          {
            id: "calls",
            label: "Earnings calls",
            count: concallEntries.length,
            panel:
              concallEntries.length === 0 ? (
                <EmptyState
                  title="No earnings calls yet"
                  description="Upload a transcript under Documents with the type set to concall, then summarise it here."
                />
              ) : (
                <ConcallSummaries entries={concallEntries} />
              ),
          },
          {
            id: "ask",
            label: "Ask",
            panel: (
              <StockChat
                stockId={stock.id}
                symbol={stock.symbol}
                initialMessages={chatMessages}
                hasFinancials={financials.length > 0}
              />
            ),
          },
        ]}
      />
    </>
  );
}
