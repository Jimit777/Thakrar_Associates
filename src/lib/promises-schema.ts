import { z } from "zod";

/**
 * What management said would happen, set against what the figures went on to
 * show.
 *
 * Concall summaries already record each piece of guidance and whether it came
 * with numbers. The step nobody takes is going back a year later to check. A
 * company that consistently hits what it guides to is telling you something
 * about itself that no ratio does — and so is one that consistently doesn't.
 */

const PromiseSchema = z.object({
  said_in: z.string().describe("The call it was said on, e.g. 'Q2 FY2025'."),
  topic: z.string().describe("What it was about, a few words: 'Margin', 'Capex', 'AUM growth'."),
  promised: z
    .string()
    .describe("What management actually said, under 30 words. Their claim, not your paraphrase of its significance."),
  outcome: z
    .enum(["met", "missed", "partly", "too_early", "unclear"])
    .describe(
      "met = the figures show it happened. missed = they show it did not. partly = some of it. too_early = the period it covers hasn't been reported yet. unclear = the confirmed figures cannot settle it.",
    ),
  evidence: z
    .string()
    .describe(
      "The figures that decide it, with periods named, under 35 words. For too_early, say which filing will answer it. For unclear, say what is missing.",
    ),
});

export const PromisesSchema = z.object({
  promises: z
    .array(PromiseSchema)
    .describe(
      "Every piece of guidance you can trace, newest first. Empty array if the calls contain no checkable guidance.",
    ),
  record: z
    .string()
    .describe(
      "One sentence on the pattern across all of them — whether this management tends to deliver what it guides to. Say plainly if there is too little history to tell.",
    ),
});

export type Promises = z.infer<typeof PromisesSchema>;

export const PROMISES_PROMPT = `You are checking what a company's management said would happen against what its figures went on to show.

You have summaries of the earnings calls the user has uploaded — each with the guidance given and whether it carried numbers — and the user's confirmed financial figures.

For each piece of guidance:
- Quote what was said, briefly and in their terms. Do not soften it and do not sharpen it.
- Find the periods that would settle it and look at what they show.
- Judge it: met, missed, partly, too early, or unclear.
- Give the figures behind that judgement, with periods named. A verdict the reader cannot check is worth nothing.

Be strict about the difference between too_early and unclear. Too early means the period has not been reported yet — the answer is coming. Unclear means the figures the user has confirmed cannot settle it, either because the relevant line was never extracted or because the guidance was too vague to test. Say which.

Vague guidance is still worth listing, marked unclear, with a note that it was not specific enough to check. A company that only ever guides in adjectives is telling you something too.

Rules:
- Use only the confirmed figures and the call summaries. You have no web search here, so do not claim anything you cannot source from what is in front of you.
- Never contradict the confirmed figures.
- Mind the periods: guidance given on a Q2 call about "the full year" is tested against the annual figures, not the next quarter's.
- No investment advice. Report the record; do not draw a conclusion about whether to own the stock.
- Be brief. Every field has a word limit; treat it as a maximum.`;
