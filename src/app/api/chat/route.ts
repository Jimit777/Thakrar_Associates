import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { buildStockContext, CHAT_SYSTEM_PROMPT } from "@/lib/chat-context";
import { GEMINI_MODELS } from "@/lib/gemini";
import { fetchPriceSummary } from "@/lib/prices";
import { sortByPeriod } from "@/lib/periods";
import { normaliseFigures, type FinancialRow } from "@/types/financial";
import type { ConcallSummary } from "@/lib/concall-schema";

export const maxDuration = 120;

/** Only the recent exchanges are replayed, to keep each request small. */
const HISTORY_LIMIT = 20;

type ChatContent = { role: "user" | "model"; parts: { text: string }[] };

/**
 * Whether a question needs looking things up, which decides the model, the
 * thinking level, and whether search is worth enabling at all.
 *
 * This used to be a keyword list, which missed anything phrased differently —
 * "how is it doing against others in pharma" contains none of the obvious
 * words. A cheap model classifies it instead: one word out, a few hundred
 * tokens, far more reliable than matching strings.
 */
async function needsResearch(ai: GoogleGenAI, question: string): Promise<boolean> {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.lite,
      contents: [{ role: "user", parts: [{ text: question }] }],
      config: {
        systemInstruction:
          "Decide whether answering the question requires looking up information outside a single company's own financial statements — for example other companies, industry context, news, management commentary, or market valuation. Questions answerable from that one company's own reported figures or its share price do not. Reply with exactly one word: RESEARCH or FIGURES.",
        maxOutputTokens: 200,
        // Minimal on purpose: a one-word classification doesn't need to reason,
        // and every reasoning token here is spent on every single message sent.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });

    return (response.text ?? "").toUpperCase().includes("RESEARCH");
  } catch {
    // If the check fails, assume research: answering thinly is worse than
    // spending a little more.
    return true;
  }
}

/**
 * Both paths run on the same model tier, differing in how hard they are
 * allowed to work: a research question gets a higher thinking level and a
 * larger output ceiling, a figure question reads a small block of
 * already-confirmed numbers and doesn't need either.
 *
 * Unlike Anthropic's server-side search, Gemini's grounding runs entirely
 * inside one streamed call — there is no paused turn to resume, so the retry
 * loop that existed for that has no equivalent here.
 */
function openStream(
  ai: GoogleGenAI,
  contents: ChatContent[],
  system: string,
  research: boolean,
) {
  return ai.models.generateContentStream({
    model: GEMINI_MODELS.pro,
    contents,
    config: {
      systemInstruction: system,
      maxOutputTokens: research ? 2500 : 2000,
      // Summarised reasoning is streamed to the user. Billing is unchanged by
      // this — the model thinks either way; without it the wait just looks
      // like a stall.
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: research ? ThinkingLevel.MEDIUM : ThinkingLevel.LOW,
      },
      tools: [{ googleSearch: {} }],
    },
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY is not set on the server." },
      { status: 500 },
    );
  }

  const { stockId, message } = await request.json();
  if (!stockId || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Missing question." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  // Row level security scopes this to the signed-in user's own stock.
  const { data: stock } = await supabase
    .from("stocks")
    .select("id, symbol, name, sector")
    .eq("id", stockId)
    .maybeSingle<{
      id: string;
      symbol: string;
      name: string | null;
      sector: string | null;
    }>();

  if (!stock) return Response.json({ error: "Stock not found." }, { status: 404 });

  // All three run together. The price lookup used to run after the database
  // queries, adding its round trip to every single message before the model
  // was even called.
  const [
    { data: financialsData },
    { data: historyData },
    priceSummary,
    { data: concallData },
  ] =
    await Promise.all([
      supabase
        .from("financials")
        .select("id, period_type, period_label, basis, currency_unit, data")
        .eq("stock_id", stock.id),
      supabase
        .from("chat_messages")
        .select("role, content")
        .eq("stock_id", stock.id)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
      fetchPriceSummary(stock.symbol).catch(() => null),
      supabase
        .from("concall_summaries")
        .select("period_label, content")
        .eq("stock_id", stock.id),
    ]);

  const rows: FinancialRow[] = sortByPeriod(
    (financialsData ?? []).map((row) => ({
      ...(row as FinancialRow),
      data: normaliseFigures((row as { data: unknown }).data),
    })),
  );

  const context = buildStockContext({
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    rows,
    price: priceSummary,
    concalls: (concallData ?? []).map((row) => ({
      period: row.period_label as string,
      summary: row.content as ConcallSummary,
    })),
  });

  const priorMessages: ChatContent[] = (historyData ?? [])
    .reverse()
    .map((row) => ({
      role: row.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: row.content as string }],
    }));

  const ai = new GoogleGenAI({ apiKey });

  // One system string rather than Anthropic's blocks-with-cache_control: Gemini
  // caches a repeated prefix automatically, with no setup needed on our side.
  const system = `${CHAT_SYSTEM_PROMPT}\n\nHere are the confirmed figures for this stock:\n\n${context}`;

  const encoder = new TextEncoder();
  let answer = "";
  const research = await needsResearch(ai, message);

  // Status updates travel on the same stream as the answer, wrapped in record
  // separators so the client can tell them apart from the reply text.
  const frame = (payload: Record<string, unknown>) =>
    encoder.encode(`${JSON.stringify(payload)}`);

  const status = (label: string) => frame({ type: "status", label });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const contents: ChatContent[] = [
          ...priorMessages,
          { role: "user", parts: [{ text: message }] },
        ];

        controller.enqueue(status("Thinking"));
        if (research) controller.enqueue(status("Searching the web"));

        const stream = await openStream(ai, contents, system, research);

        let finishReason: string | undefined;

        for await (const chunk of stream) {
          const candidate = chunk.candidates?.[0];
          finishReason = candidate?.finishReason ?? finishReason;

          for (const part of candidate?.content?.parts ?? []) {
            if (part.thought && part.text) {
              controller.enqueue(frame({ type: "thinking", text: part.text }));
              continue;
            }

            if (part.text) {
              if (!answer) controller.enqueue(status("Writing"));
              answer += part.text;
              controller.enqueue(encoder.encode(part.text));
            }
          }
        }

        // A response blocked before producing any text — the closest
        // equivalent to Anthropic's stop_reason "refusal".
        if (!answer && finishReason && finishReason !== "STOP") {
          controller.enqueue(encoder.encode("I can't help with that request."));
        }
      } catch (cause) {
        const text =
          cause instanceof Error ? cause.message : "Something went wrong.";
        controller.enqueue(encoder.encode(`\n\n[Error: ${text}]`));
      } finally {
        controller.close();

        // Saved after the fact so an interrupted answer isn't stored as if
        // complete, and so the question is never saved without its reply.
        if (answer.trim()) {
          await supabase.from("chat_messages").insert([
            { user_id: user.id, stock_id: stock.id, role: "user", content: message },
            { user_id: user.id, stock_id: stock.id, role: "assistant", content: answer },
          ]);
        }
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
