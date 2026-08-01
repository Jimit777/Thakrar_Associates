/**
 * Which Claude model reads uploaded PDFs. Extraction is the expensive step
 * (a long report is hundreds of thousands of tokens), so it is selectable.
 *
 * Analysis and chat always run on Opus: they only ever read the small set of
 * already-extracted figures, so the stronger model costs almost nothing there.
 */
export const EXTRACTION_MODELS = [
  {
    id: "claude-sonnet-5",
    label: "Sonnet",
    note: "Default. Around half the cost of Opus, handles long reports.",
  },
  {
    id: "claude-opus-5",
    label: "Opus",
    note: "Most capable. Worth trying if Sonnet misreads a dense table.",
  },
  {
    id: "claude-haiku-4-5",
    label: "Haiku",
    note: "Cheapest, but caps out around 100 pages and is weakest on tables.",
  },
] as const;

export type ExtractionModelId = (typeof EXTRACTION_MODELS)[number]["id"];

export const DEFAULT_EXTRACTION_MODEL: ExtractionModelId = "claude-sonnet-5";

/** Model used for the per-stock chat. */
export const ANALYSIS_MODEL = "claude-opus-5";

/**
 * The briefing runs on Sonnet rather than Opus. It is a summarising job over
 * figures that are already extracted, which Sonnet handles well — and it is the
 * single most expensive action in the app, so the cheaper, faster model matters
 * more here than anywhere else.
 */
export const BRIEFING_MODEL = "claude-sonnet-5";

/**
 * Decides whether a chat question needs web research. One word of output on the
 * cheapest model — a fraction of a paisa, and far more reliable than trying to
 * spot research questions by keyword.
 */
export const CLASSIFIER_MODEL = "claude-haiku-4-5";

/** Never trust a model name sent from the browser. */
export function resolveExtractionModel(value: unknown): ExtractionModelId {
  return EXTRACTION_MODELS.some((model) => model.id === value)
    ? (value as ExtractionModelId)
    : DEFAULT_EXTRACTION_MODEL;
}
