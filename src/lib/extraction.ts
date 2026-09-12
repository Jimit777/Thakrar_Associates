import { generateStructured } from "./gemini";
import {
  ExtractionSchema,
  EXTRACTION_PROMPT,
  type Extraction,
} from "./extraction-schema";
import { DEFAULT_EXTRACTION_MODEL, type ExtractionModelId } from "./models";

/**
 * A Q4 filing prints the full-year audited figures alongside the quarter, which
 * would compete with the annual report's own numbers for the same year. Annual
 * reports have no such conflict, so anything they contain is worth keeping.
 */
function periodInstruction(kind: string) {
  if (kind === "annual_report") {
    return "This is an annual report. Extract every period it reports — full years including prior-year comparatives, and any quarterly tables it contains as well.";
  }
  if (kind === "quarterly_result") {
    return "This is a quarterly filing. Extract only quarterly periods (Q1 FY2025, Q2 FY2025 and so on), including the prior-year quarter shown for comparison. Q4 filings usually also print full-year audited figures — ignore those, as full-year figures are taken from the annual report instead.";
  }
  return "Extract every period the document reports.";
}

/**
 * Sends a report PDF to Gemini and asks for the income statement, balance
 * sheet and cash flow figures.
 *
 * The response is constrained to a fixed schema, so what comes back is always
 * shaped correctly — but the numbers themselves still need a human check,
 * which is what the review step is for.
 *
 * This is the single most accuracy-sensitive call in the app: every scorecard,
 * valuation and chart traces back to what is read here. It runs at the highest
 * thinking level available, whichever tier is chosen — the ceiling that keeps
 * every other action cheap is the wrong place to save money on this one.
 */
export async function extractFinancialsFromPdf(
  pdfBase64: string,
  context: { symbol: string; periodLabel: string; kind: string },
  model: ExtractionModelId = DEFAULT_EXTRACTION_MODEL,
): Promise<Extraction> {
  return generateStructured({
    tier: model,
    system: EXTRACTION_PROMPT,
    prompt: `This document is for ${context.symbol}, labelled ${context.periodLabel}.\n\n${periodInstruction(context.kind)}`,
    pdfs: [{ base64: pdfBase64 }],
    schema: ExtractionSchema,
    thinking: "high",
    // A long report can run to many periods and three full statements —
    // generous headroom so a good extraction is never cut short.
    maxOutputTokens: 16000,
  });
}
