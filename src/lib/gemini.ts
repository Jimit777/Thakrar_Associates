import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

/**
 * The Gemini side of the app.
 *
 * Deliberately shaped like the Anthropic calls it replaces — a system prompt, a
 * Zod schema, an optional search budget — so migrating a call site is a change
 * of function rather than a rewrite of its logic.
 *
 * Two differences from Claude worth knowing, because they change what the code
 * has to do rather than just what it costs:
 *
 * - Schema conformance is enforced during decoding, not asked for in a prompt,
 *   so malformed JSON is not a failure mode here. It is still parsed through
 *   Zod, because "valid JSON in the right shape" and "values that make sense"
 *   are different claims.
 * - Thinking is capped by a number rather than an effort level. Reasoning bills
 *   at output rates on both providers, and this is the more direct control.
 */

/** Model tiers, mirroring how the Anthropic ones are chosen. */
export const GEMINI_MODELS = {
  /** Dense PDFs and anything where a misread is expensive. */
  pro: "gemini-3.1-pro-preview",
  /** Classification and short structured answers. */
  lite: "gemini-3.1-flash-lite",
} as const;

export type GeminiTier = keyof typeof GEMINI_MODELS;

export class GeminiNotConfigured extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set on the server.");
  }
}

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfigured();
  return new GoogleGenAI({ apiKey });
}

export type GeminiRequest<T extends z.ZodType> = {
  tier: GeminiTier;
  system: string;
  /** Plain text, or text plus PDFs to read. */
  prompt: string;
  pdfs?: { base64: string; label?: string }[];
  schema: T;
  /** Omit to leave search off. Grounding is free below Google's monthly quota,
   *  but the pages it pulls back are billed as ordinary input tokens. */
  search?: boolean;
  /**
   * Reasoning ceiling. "low" is enough for retrieval and classification,
   * "medium" for weighing several pieces of evidence against each other,
   * "high" for the one call where a misread costs the most: reading figures
   * out of a dense financial statement.
   */
  thinking?: "low" | "medium" | "high";
  /** Output ceiling. Reasoning tokens are billed at this rate and count
   *  against it, so a low default would silently truncate a real answer. */
  maxOutputTokens?: number;
};

const THINKING_LEVELS: Record<
  NonNullable<GeminiRequest<z.ZodType>["thinking"]>,
  ThinkingLevel
> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/**
 * Runs one structured request and returns a parsed, validated result.
 *
 * Throws rather than returning an error shape, so callers keep the try/catch
 * they already have around the Anthropic version.
 */
export async function generateStructured<T extends z.ZodType>(
  request: GeminiRequest<T>,
): Promise<z.infer<T>> {
  const ai = client();

  const parts: Record<string, unknown>[] = [];

  for (const pdf of request.pdfs ?? []) {
    parts.push({
      inlineData: { mimeType: "application/pdf", data: pdf.base64 },
    });
  }

  parts.push({ text: request.prompt });

  const response = await ai.models.generateContent({
    model: GEMINI_MODELS[request.tier],
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: request.system,
      responseMimeType: "application/json",
      // Zod is the single source of truth for shape on both providers.
      responseSchema: z.toJSONSchema(request.schema, { target: "draft-7" }),
      maxOutputTokens: request.maxOutputTokens,
      thinkingConfig: {
        thinkingLevel: THINKING_LEVELS[request.thinking ?? "low"],
      },
      ...(request.search ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });

  // A prompt can be blocked before generation starts, or a candidate can stop
  // early without producing text — the two ways Gemini declines a request.
  // Neither is an exception on the SDK's side, so both are checked explicitly
  // rather than assumed away.
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Gemini declined this request (${blockReason}).`);
  }

  const finishReason = response.candidates?.[0]?.finishReason;
  const text = response.text;

  if (!text) {
    throw new Error(
      finishReason && finishReason !== "STOP"
        ? `Gemini produced no output (${finishReason}).`
        : "Gemini returned no output.",
    );
  }

  return request.schema.parse(JSON.parse(text));
}
