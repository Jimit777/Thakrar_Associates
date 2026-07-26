export type Stock = {
  id: string;
  symbol: string;
  name: string | null;
  sector: string | null;
};

export type DocumentKind = "annual_report" | "quarterly_result" | "concall";

export type StockDocument = {
  id: string;
  stock_id: string;
  kind: DocumentKind;
  period_label: string;
  storage_path: string;
  file_name: string;
  file_size_bytes: number | null;
  created_at: string;
};

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  annual_report: "Annual report",
  quarterly_result: "Quarterly result",
  concall: "Concall transcript",
};

/**
 * Upload ceiling. Claude's request limit is 32 MB, and encoding a PDF for the
 * API inflates it by about a third — so anything above ~23 MB would be
 * rejected at extraction time. Capped below that to fail at upload instead,
 * where the message is clearer.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
