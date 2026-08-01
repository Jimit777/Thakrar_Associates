import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading, EmptyState } from "@/components/page-heading";
import { DocumentUpload } from "@/components/document-upload";
import { ExtractionReview } from "@/components/extraction-review";
import { PriceChart } from "@/components/price-chart";
import { StockChat, type ChatMessage } from "@/components/stock-chat";
import { StockInsights } from "@/components/stock-insights";
import {
  ConcallSummaries,
  type ConcallEntry,
} from "@/components/concall-summaries";
import type { Insights } from "@/lib/insights-schema";
import type { ConcallSummary } from "@/lib/concall-schema";
import { SavedFinancials } from "@/components/saved-financials";
import { createClient } from "@/lib/supabase/server";
import { deleteDocument, deleteStock } from "../actions";
import { getPriceHistory } from "../price";
import { sortByPeriod } from "@/lib/periods";
import {
  DOCUMENT_KIND_LABELS,
  type StockDocument,
  type Stock,
} from "@/types/stock";
import { normaliseFigures, type FinancialRow } from "@/types/financial";

// Reading a long report can take a few minutes, so allow for it.
export const maxDuration = 300;

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

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

      <div className="mt-8">
        <DocumentUpload stockId={stock.id} userId={user.id} />
      </div>

      <div className="mt-8">
        {documents.length === 0 ? (
          <EmptyState
            title="No documents yet"
            description="Upload an annual report or quarterly result above. Reading the figures out of them comes next."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-2xl border-collapse bg-surface">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-left">
                  <th className="stat-label px-4 py-3">Document</th>
                  <th className="stat-label px-4 py-3">Type</th>
                  <th className="stat-label px-4 py-3">Period</th>
                  <th className="stat-label px-4 py-3 text-right">Size</th>
                  <th className="stat-label px-4 py-3">Uploaded</th>
                  <th className="stat-label px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm font-medium">{doc.file_name}</td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {DOCUMENT_KIND_LABELS[doc.kind]}
                    </td>
                    <td className="figure px-4 py-3 text-sm">{doc.period_label}</td>
                    <td className="figure px-4 py-3 text-right text-sm text-muted">
                      {formatFileSize(doc.file_size_bytes)}
                    </td>
                    <td className="figure px-4 py-3 text-sm text-muted">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start justify-end gap-2">
                        <ExtractionReview
                          documentId={doc.id}
                          stockId={stock.id}
                          label={`${doc.file_name} (${doc.period_label})`}
                        />
                        <form action={deleteDocument} className="inline">
                          <input type="hidden" name="id" value={doc.id} />
                          <input
                            type="hidden"
                            name="storage_path"
                            value={doc.storage_path}
                          />
                          <button
                            type="submit"
                            className="rounded border border-border px-2 py-1 text-xs transition-colors hover:border-negative hover:text-negative"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SavedFinancials rows={financials} />

      <ConcallSummaries entries={concallEntries} />

      <StockChat
        stockId={stock.id}
        symbol={stock.symbol}
        initialMessages={chatMessages}
        hasFinancials={financials.length > 0}
      />
    </>
  );
}
