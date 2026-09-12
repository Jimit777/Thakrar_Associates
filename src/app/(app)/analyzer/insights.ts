"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildStockContext } from "@/lib/chat-context";
import { InsightsSchema, INSIGHTS_PROMPT } from "@/lib/insights-schema";
import { generateStructured } from "@/lib/gemini";
import { fetchPriceSummary } from "@/lib/prices";
import { sortByPeriod } from "@/lib/periods";
import { normaliseFigures, type FinancialRow } from "@/types/financial";

export type InsightsResult = { error?: string; ok?: boolean };

/**
 * Builds the overview and assessment for a stock and caches it. Costs a
 * search-backed model call, so it runs only when asked — never on page load.
 */
export async function generateInsights(stockId: string): Promise<InsightsResult> {
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

  try {
    const content = await generateStructured({
      tier: "pro",
      system: INSIGHTS_PROMPT,
      prompt: `Produce the briefing for ${stock.symbol}${stock.name ? ` (${stock.name})` : ""}, an Indian listed company.\n\nThe user's confirmed figures:\n\n${context}`,
      schema: InsightsSchema,
      search: true,
      thinking: "medium",
      // Internal reasoning counts towards this ceiling, not just the visible
      // JSON. The brevity limits live in the prompt instead of a tight cap.
      maxOutputTokens: 8000,
    });

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
