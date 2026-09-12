/**
 * Which Gemini tier reads an uploaded PDF. Extraction is the one call where a
 * misread costs the most — a wrong figure here becomes a wrong scorecard,
 * valuation and chart everywhere else in the app — so it stays selectable
 * rather than fixed.
 */
export const EXTRACTION_MODELS = [
  {
    id: "pro",
    label: "Gemini Pro",
    note: "Default. Reads dense, multi-column financial tables reliably.",
  },
  {
    id: "lite",
    label: "Gemini Flash-Lite",
    note: "Cheaper and faster. Fine for a short or simple filing; worth trying Pro if it misreads a table.",
  },
] as const;

export type ExtractionModelId = (typeof EXTRACTION_MODELS)[number]["id"];

export const DEFAULT_EXTRACTION_MODEL: ExtractionModelId = "pro";

/** Never trust a model name sent from the browser. */
export function resolveExtractionModel(value: unknown): ExtractionModelId {
  return EXTRACTION_MODELS.some((model) => model.id === value)
    ? (value as ExtractionModelId)
    : DEFAULT_EXTRACTION_MODEL;
}
