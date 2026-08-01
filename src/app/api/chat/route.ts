import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildStockContext, CHAT_SYSTEM_PROMPT } from "@/lib/chat-context";
import { ANALYSIS_MODEL, BRIEFING_MODEL, CLASSIFIER_MODEL } from "@/lib/models";
import { fetchPriceSummary } from "@/lib/prices";
import { sortByPeriod } from "@/lib/periods";
import { normaliseFigures, type FinancialRow } from "@/types/financial";
import type { ConcallSummary } from "@/lib/concall-schema";

export const maxDuration = 120;

/** Only the recent exchanges are replayed, to keep each request small. */
const HISTORY_LIMIT = 20;

/**
 * Fast mode runs the same model at a higher output speed for a premium rate.
 * It's a research preview, so a failure falls back to the standard endpoint
 * rather than breaking the chat.
 */
const FAST_MODE_BETA = "fast-mode-2026-02-01";

/**
 * Whether a question needs looking things up, which decides the model, the
 * effort and the search budget.
 *
 * This used to be a keyword list, which missed anything phrased differently —
 * "how is it doing against others in pharma" contains none of the obvious
 * words. A cheap, fast model classifies it instead: one word out, a few
 * hundred tokens, far more reliable than matching strings.
 */
async function needsResearch(
  client: Anthropic,
  question: string,
): Promise<boolean> {
  try {
    const response = await client.messages.create({
      model: CLASSIFIER_MODEL,
      max_tokens: 5,
      system:
        "Decide whether answering the question requires looking up information outside a single company's own financial statements — for example other companies, industry context, news, management commentary, or market valuation. Questions answerable from that one company's own reported figures or its share price do not. Reply with exactly one word: RESEARCH or FIGURES.",
      messages: [{ role: "user", content: question }],
    });

    const text = response.content.find((block) => block.type === "text");
    return text?.type === "text" && text.text.toUpperCase().includes("RESEARCH");
  } catch {
    // If the check fails, assume research: answering thinly is worse than
    // spending a little more.
    return true;
  }
}

/**
 * Always the beta endpoint so the response types line up whether or not fast
 * mode is in play — mixing the two produces incompatible content blocks.
 */
function openStream(
  client: Anthropic,
  conversation: Anthropic.Beta.BetaMessageParam[],
  system: Anthropic.Beta.BetaTextBlockParam[],
  fast: boolean,
  research: boolean,
) {
  // Research questions pull in web pages and run longer, so their token count
  // is what drives cost — the cheaper model matters most there. Questions about
  // the user's own figures are small, so they stay on the faster model where
  // latency is what the user notices.
  //
  // Fast mode is an Opus feature, so it only applies to the quick path.
  const useFast = fast && !research;

  return client.beta.messages.stream({
    model: research ? BRIEFING_MODEL : ANALYSIS_MODEL,
    max_tokens: research ? 2500 : 2000,
    // Summarised reasoning is streamed to the user. Billing is unchanged by
    // this — the model thinks either way; without it the wait just looks like
    // a stall.
    thinking: { type: "adaptive", display: "summarized" },
    // Medium is enough to keep the model reaching for search; high mostly
    // bought extra internal reasoning, which is billed at output rates.
    output_config: { effort: research ? "medium" : "low" },
    system,
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: research ? 5 : 3,
      },
    ],
    messages: conversation,
    ...(useFast ? { speed: "fast" as const, betas: [FAST_MODE_BETA] } : {}),
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not set on the server." },
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
  // queries, adding its round trip to every single message before Claude was
  // even called.
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

  const priorMessages = (historyData ?? [])
    .reverse()
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));

  const client = new Anthropic({ apiKey });

  const systemBlocks: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: CHAT_SYSTEM_PROMPT },
    {
      type: "text",
      text: `Here are the confirmed figures for this stock:\n\n${context}`,
      // The figures rarely change between questions, so caching this makes
      // follow-up questions cheaper.
      cache_control: { type: "ephemeral" },
    },
  ];

  const encoder = new TextEncoder();
  let answer = "";
  const research = await needsResearch(client, message);

  // Status updates travel on the same stream as the answer, wrapped in record
  // separators so the client can tell them apart from the reply text.
  const frame = (payload: Record<string, unknown>) =>
    encoder.encode(`${JSON.stringify(payload)}`);

  const status = (label: string) => frame({ type: "status", label });

  let fastMode = true;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const conversation: Anthropic.Beta.BetaMessageParam[] = [
          ...priorMessages,
          { role: "user", content: message },
        ];

        // Web search runs on Anthropic's side. A long search can pause the
        // turn, which is resumed by sending the conversation back unchanged.
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const stream = openStream(
            client,
            conversation,
            systemBlocks,
            fastMode,
            research,
          );

          controller.enqueue(status(attempt === 0 ? "Thinking" : "Still working"));

          for await (const event of stream) {
            if (
              event.type === "content_block_start" &&
              event.content_block.type === "server_tool_use"
            ) {
              controller.enqueue(status("Searching the web"));
            }

            if (
              event.type === "content_block_delta" &&
              event.delta.type === "thinking_delta"
            ) {
              controller.enqueue(
                frame({ type: "thinking", text: event.delta.thinking }),
              );
            }

            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              if (!answer) controller.enqueue(status("Writing"));
              answer += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }

          const final = await stream.finalMessage();

          if (final.stop_reason === "refusal" && !answer) {
            controller.enqueue(encoder.encode("I can't help with that request."));
            break;
          }

          if (final.stop_reason !== "pause_turn") break;

          conversation.push({ role: "assistant", content: final.content });
        }
      } catch (cause) {
        // Fast mode is a preview and may not be enabled on every account.
        // Retry once at standard speed before surfacing an error.
        if (fastMode && !answer) {
          fastMode = false;
          try {
            const stream = openStream(
              client,
              [...priorMessages, { role: "user", content: message }],
              systemBlocks,
              false,
              research,
            );

            for await (const event of stream) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                answer += event.delta.text;
                controller.enqueue(encoder.encode(event.delta.text));
              }
            }
          } catch (retryCause) {
            const text =
              retryCause instanceof Error
                ? retryCause.message
                : "Something went wrong.";
            controller.enqueue(encoder.encode(`\n\n[Error: ${text}]`));
          }
        } else {
          const text =
            cause instanceof Error ? cause.message : "Something went wrong.";
          controller.enqueue(encoder.encode(`\n\n[Error: ${text}]`));
        }
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
