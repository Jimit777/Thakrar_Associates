"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildStockContext } from "@/lib/chat-context";
import { InsightsSchema, INSIGHTS_PROMPT } from "@/lib/insights-schema";
import { BRIEFING_MODEL } from "@/lib/models";
import { fetchPriceSummary } from "@/lib/prices";
import { sortByPeriod } from "@/lib/periods";
import { normaliseFigures, type FinancialRow } from "@/types/financial";

export type InsightsResult = { error?: string; ok?: boolean };

/**
 * Builds the overview and assessment for a stock and caches it. Costs a
 * web-search-backed model call, so it runs only when asked — never on page load.
 */
export async function generateInsights(stockId: string): Promise<InsightsResult> {
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

  const { data: financialsData } = await supabase
    .from("financials")
    .select("id, period_type, period_label, basis, currency_unit, data")
    .eq("stock_id", stock.id);

  const rows: FinancialRow[] = sortByPeriod(
    (financialsData ?? []).map((row) => ({
      ...(row as FinancialRow),
      data: normaliseFigures((row as { data: unknown }).data),
    })),
  );

  const priceSummary = await fetchPriceSummary(stock.symbol).catch(() => null);

  const context = buildStockContext({
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    rows,
    price: priceSummary,
  });

  const client = new Anthropic({ apiKey });

  try {
    // Medium effort still searches, but generates far less internal reasoning —
    // which is billed at output rates and was most of what this used to cost.
    // Search count is capped too: each result pulls page content into the input.
    const stream = client.messages.stream({
      model: BRIEFING_MODEL,
      // Internal reasoning counts towards this ceiling, not just the visible
      // JSON. At 3000 the model spent most of it thinking and returned empty
      // strengths and concerns — the brevity limits live in the prompt instead.
      max_tokens: 8000,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(InsightsSchema),
      },
      system: INSIGHTS_PROMPT,
      // Halved once the business overview moved to the cheap key-points action:
      // each search pulls page content into the input, and the assessment is
      // mostly arithmetic on figures that are already here.
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }],
      messages: [
        {
          role: "user",
          content: `Produce the briefing for ${stock.symbol}${stock.name ? ` (${stock.name})` : ""}, an Indian listed company.\n\nThe user's confirmed figures:\n\n${context}`,
        },
      ],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return { error: "Claude declined to produce this briefing." };
    }

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { error: "No briefing came back. Try again." };
    }

    const content = InsightsSchema.parse(JSON.parse(textBlock.text));

    const { error } = await supabase.from("stock_insights").upsert(
      {
        stock_id: stock.id,
        user_id: user.id,
        content,
        periods_used: rows.length,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "stock_id" },
    );

    if (error) return { error: error.message };

    revalidatePath("/analyzer");
    return { ok: true };
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : "Couldn't build the briefing.",
    };
  }
}
