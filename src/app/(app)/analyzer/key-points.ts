"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildStockContext } from "@/lib/chat-context";
import { KeyPointsSchema, KEY_POINTS_PROMPT } from "@/lib/key-points-schema";
import { KEY_POINTS_MODEL } from "@/lib/models";
import { sortByPeriod } from "@/lib/periods";
import type { ConcallSummary } from "@/lib/concall-schema";
import { normaliseFigures, type FinancialRow } from "@/types/financial";

export type KeyPointsResult = { error?: string; ok?: boolean };

/**
 * The cheap, quick half of the briefing: a labelled fact sheet rather than an
 * assessment.
 *
 * Runs on the smallest model with a short output ceiling and a handful of
 * searches, because the job is finding and restating disclosed facts — not
 * reasoning about them. Earnings calls the user has already summarised go in
 * for free and are usually where the best facts are: guidance, customer mix,
 * disbursement figures. That is content a web search would otherwise have to
 * go and find.
 */
export async function generateKeyPoints(
  stockId: string,
): Promise<KeyPointsResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY is not set on the server." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

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

  if (!stock) return { error: "Stock not found." };

  const [{ data: financialsData }, { data: concallRows }, { data: deck }] =
    await Promise.all([
      supabase
        .from("financials")
        .select("id, period_type, period_label, basis, currency_unit, data")
        .eq("stock_id", stock.id),
      supabase
        .from("concall_summaries")
        .select("content, generated_at, documents(period_label)")
        .eq("stock_id", stock.id)
        .order("generated_at", { ascending: false })
        .limit(2),
      // The most recent investor presentation, if one has been uploaded. It is
      // the primary source for almost everything a fact sheet wants.
      supabase
        .from("documents")
        .select("period_label, storage_path, file_name")
        .eq("stock_id", stock.id)
        .eq("kind", "presentation")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          period_label: string;
          storage_path: string;
          file_name: string;
        }>(),
    ]);

  const rows: FinancialRow[] = sortByPeriod(
    (financialsData ?? []).map((row) => ({
      ...(row as FinancialRow),
      data: normaliseFigures((row as { data: unknown }).data),
    })),
  );

  const concalls = (concallRows ?? []).map((row) => {
    const record = row as unknown as {
      content: ConcallSummary;
      documents: { period_label: string } | null;
    };
    return {
      period: record.documents?.period_label ?? "recent call",
      summary: record.content,
    };
  });

  // No price summary here: a fact sheet does not need one, and fetching it is
  // another round trip before the model can even start.
  const context = buildStockContext({
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    rows,
    price: null,
    concalls,
  });

  // A deck is the company's own account of itself, so when one is available it
  // replaces searching entirely: primary source, one request, no guessing which
  // of five news articles paraphrased the slide correctly.
  let deckBase64: string | null = null;

  if (deck) {
    const { data: file } = await supabase.storage
      .from("documents")
      .download(deck.storage_path);

    if (file) {
      const encoded = Buffer.from(await file.arrayBuffer()).toString("base64");
      // The API caps a request at 32 MB and base64 inflates by about a third.
      // A presentation this large is a scan; fall back to searching instead of
      // failing the whole action.
      if (encoded.length < 20_000_000) deckBase64 = encoded;
    }
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: KEY_POINTS_MODEL,
      // A fact sheet is short. The ceiling covers internal reasoning too, so it
      // is the main brake on both cost and how long the user waits.
      max_tokens: 4000,
      // No effort setting: Haiku rejects the parameter outright. The output
      // ceiling above is what keeps this short, which is the point anyway.
      output_config: { format: zodOutputFormat(KeyPointsSchema) },
      system: KEY_POINTS_PROMPT,
      // Searching only earns its cost when there is no deck to read. With one,
      // a search would just find a worse version of what is already in hand —
      // so the tool is left off the request entirely rather than offered and
      // hopefully declined.
      ...(deckBase64
        ? {}
        : {
            tools: [
              {
                type: "web_search_20260209" as const,
                name: "web_search",
                max_uses: 3,
                // Haiku can't call tools programmatically, and the search tool
                // asks for that by default. "direct" is the plain
                // call-and-get-results path, which is all a fact sheet needs.
                allowed_callers: ["direct" as const],
              },
            ],
          }),
      messages: [
        {
          role: "user",
          content: [
            ...(deckBase64 && deck
              ? ([
                  {
                    type: "document" as const,
                    source: {
                      type: "base64" as const,
                      media_type: "application/pdf" as const,
                      data: deckBase64,
                    },
                  },
                  {
                    type: "text" as const,
                    text: `The document above is ${stock.symbol}'s investor presentation for ${deck.period_label} (${deck.file_name}). Take the key points from it — it is the company's own account of itself, and you have no web search here. Cite it as "${deck.period_label} investor presentation" with an empty URL.`,
                  },
                ])
              : []),
            {
              type: "text" as const,
              text: `Write the key points for ${stock.symbol}${stock.name ? ` (${stock.name})` : ""}, an Indian listed company.\n\nWhat the user has already confirmed:\n\n${context}`,
            },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return { error: "Claude declined to produce this fact sheet." };
    }

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { error: "Nothing came back. Try again." };
    }

    const content = KeyPointsSchema.parse(JSON.parse(textBlock.text));

    const { error } = await supabase.from("stock_key_points").upsert(
      {
        stock_id: stock.id,
        user_id: user.id,
        content,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "stock_id" },
    );

    if (error) return { error: error.message };

    revalidatePath("/analyzer");
    return { ok: true };
  } catch (cause) {
    return {
      error:
        cause instanceof Error ? cause.message : "Couldn't build the key points.",
    };
  }
}
