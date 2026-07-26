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
            text: `This is a ${context.kind.replace(/_/g, " ")} for ${context.symbol}, labelled ${context.periodLabel}. Extract the income statement figures for every period it reports.`,
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
