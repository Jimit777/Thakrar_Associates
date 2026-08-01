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

  const [{ data: financialsData }, { data: concallRows }] = await Promise.all([
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

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: KEY_POINTS_MODEL,
      // A fact sheet is short. The ceiling covers internal reasoning too, so it
      // is the main brake on both cost and how long the user waits.
      max_tokens: 4000,
      output_config: {
        // Not "low": low effort suppresses tool use, and this needs to search.
        effort: "medium",
        format: zodOutputFormat(KeyPointsSchema),
      },
      system: KEY_POINTS_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages: [
        {
          role: "user",
          content: `Write the key points for ${stock.symbol}${stock.name ? ` (${stock.name})` : ""}, an Indian listed company.\n\nWhat the user has already confirmed:\n\n${context}`,
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
