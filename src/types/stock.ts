export type Stock = {
  id: string;
  symbol: string;
  name: string | null;
  sector: string | null;
};

export type DocumentKind =
  | "annual_report"
  | "quarterly_result"
  | "concall"
  | "presentation";

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
  presentation: "Investor presentation",
};

/**
 * Upload ceiling. Gemini's inline request body is capped around 20 MB, and
 * base64 inflates a PDF by about a third — so anything above ~14 MB raw would
 * be rejected at extraction time. Capped below that to fail at upload instead,
 * where the message is clearer.
 *
 * Applied the same way regardless of document kind, even though only concall
 * transcripts and investor presentations are sent whole — annual reports get
 * trimmed to their financial-statement pages first. A single ceiling low
 * enough for the untrimmed case is simpler than one that varies by kind.
 */
export const MAX_UPLOAD_BYTES = 13 * 1024 * 1024;
