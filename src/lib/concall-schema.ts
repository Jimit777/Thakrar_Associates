import { z } from "zod";

/**
 * A concall transcript is not a financial statement — the value is in what
 * management committed to, what they avoided, and what analysts pushed on.
 *
 * Everything here is attributable back to the transcript: quotes carry the
 * speaker, guidance records whether a number was actually given, and what was
 * *not* addressed is captured too, because a dodged question is often the most
 * informative part of a call.
 */

export const ConcallSummarySchema = z.object({
  headline: z
    .string()
    .describe("The single most important thing from this call, in one sentence."),
  sentiment: z
    .enum(["confident", "measured", "cautious", "defensive", "mixed"])
    .describe("Management's overall tone, judged from how they answered."),
  sentiment_basis: z
    .string()
    .describe("What in the call led you to that reading. One sentence."),
  key_points: z
    .array(z.string())
    .describe("Three to five things management said about the business. One sentence each."),
  guidance: z
    .array(
      z.object({
        topic: z.string().describe("What the guidance concerns, a few words."),
        said: z.string().describe("What was actually said, under 30 words."),
        quantified: z
          .boolean()
          .describe(
            "True only if they gave a number or a firm date. Vague direction is not quantified.",
          ),
      }),
    )
    .describe("Forward-looking statements. Empty array if none were given."),
  analyst_focus: z
    .array(
      z.object({
        question: z.string().describe("What analysts pressed on, under 20 words."),
        response: z
          .string()
          .describe("How management answered, under 30 words. Say if they deflected."),
      }),
    )
    .describe("Two or three topics analysts kept returning to."),
  quotes: z
    .array(
      z.object({
        speaker: z.string().describe("Name and role as given in the transcript."),
        quote: z.string().describe("Verbatim, under 40 words. Never paraphrase here."),
      }),
    )
    .describe("Up to three quotes that carry real information."),
  risks_flagged: z
    .array(z.string())
    .describe("Risks or headwinds management themselves raised. One sentence each."),
  not_addressed: z
    .string()
    .describe(
      "Questions raised but not answered, or obvious topics avoided. Empty string if nothing notable.",
    ),
});

export type ConcallSummary = z.infer<typeof ConcallSummarySchema>;

export const CONCALL_PROMPT = `You are summarising an Indian company's earnings call transcript for someone who follows their own investments but is not a finance professional.

What matters in a call is not the numbers — those are in the filings. It is what management committed to, how they answered pressure, and what they left alone.

Rules:
- Everything must be traceable to the transcript. Do not add context from elsewhere, and do not infer beyond what was said.
- Quotes must be verbatim and attributed to the named speaker. Never paraphrase inside a quote. If you cannot reproduce it exactly, do not quote it.
- Mark guidance as quantified only when a number or firm date was given. "We expect strong growth" is not quantified; "we expect 15% growth in FY2026" is. This distinction matters more than the guidance itself.
- Record what was asked but not answered. A deflected question tells the reader something a summary of answers alone would hide.
- Judge tone from how management responded under questioning, not from the prepared remarks — and say what led you to that reading.
- Plain English. Explain a term briefly the first time if it is genuinely needed.
- No investment advice, no view on whether the shares are worth buying, no price targets. Report what was said.
- Respect the word limits in the schema. This should read in about a minute.`;
