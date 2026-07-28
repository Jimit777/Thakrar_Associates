import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ExtractionSchema,
  EXTRACTION_PROMPT,
  type Extraction,
} from "./extraction-schema";
import { DEFAULT_EXTRACTION_MODEL, type ExtractionModelId } from "./models";

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (and to Vercel for the live site).",
    );
  }
  return new Anthropic({ apiKey });
}

/**
 * Sends a report PDF to Claude and asks for the income statement figures.
 *
 * The response is constrained to a fixed schema, so what comes back is always
 * shaped correctly — but the numbers themselves still need a human check,
 * which is what the review step is for.
 */
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

export async function extractFinancialsFromPdf(
  pdfBase64: string,
  context: { symbol: string; periodLabel: string; kind: string },
  model: ExtractionModelId = DEFAULT_EXTRACTION_MODEL,
): Promise<Extraction> {
  const client = getClient();

  // Streamed because a long report can take minutes; a plain request would
  // risk timing out before Claude finishes reading it.
  const stream = client.messages.stream({
    model,
    max_tokens: 16000,
    system: EXTRACTION_PROMPT,
    output_config: { format: zodOutputFormat(ExtractionSchema) },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: `This document is for ${context.symbol}, labelled ${context.periodLabel}.\n\n${periodInstruction(context.kind)}`,
          },
        ],
      },
    ],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("Claude declined to process this document.");
  }

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no readable output for this document.");
  }

  return ExtractionSchema.parse(JSON.parse(textBlock.text));
}
