"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildStockContext } from "@/lib/chat-context";
import { PromisesSchema, PROMISES_PROMPT } from "@/lib/promises-schema";
import { BRIEFING_MODEL } from "@/lib/models";
import { sortByPeriod } from "@/lib/periods";
import type { ConcallSummary } from "@/lib/concall-schema";
import { normaliseFigures, type FinancialRow } from "@/types/financial";

export type PromisesResult = { error?: string; ok?: boolean };

/**
 * Sets past guidance against what the figures went on to show.
 *
 * Everything it needs is already in the database — the call summaries and the
 * confirmed figures — so there is no search and no PDF to read. That makes it
 * one of the cheaper actions in the app despite running on Sonnet: the input is
 * a few thousand tokens and the output is a short table.
 */
export async function generatePromises(
  stockId: string,
): Promise<PromisesResult> {
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
      .order("generated_at", { ascending: false }),
  ]);

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

  if (concalls.length === 0) {
    return {
      error:
        "No summarised earnings calls yet. Summarise a call transcript first — the guidance comes from there.",
    };
  }

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
    price: null,
    concalls,
  });

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: BRIEFING_MODEL,
      max_tokens: 6000,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(PromisesSchema),
      },
      system: PROMISES_PROMPT,
      // No tools on purpose: everything needed is below, and a search would
      // only invite a claim that can't be traced back to the user's figures.
      messages: [
        {
          role: "user",
          content: `Check what ${stock.symbol}'s management guided to against what the figures show.\n\n${context}`,
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return { error: "Claude declined to produce this tracker." };
    }

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { error: "Nothing came back. Try again." };
    }

    const content = PromisesSchema.parse(JSON.parse(textBlock.text));

    const { error } = await supabase.from("concall_promises").upsert(
      {
        stock_id: stock.id,
        user_id: user.id,
        content,
        calls_used: concalls.length,
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
        cause instanceof Error ? cause.message : "Couldn't build the tracker.",
    };
  }
}
