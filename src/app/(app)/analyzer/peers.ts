"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PeersSchema, PEERS_PROMPT } from "@/lib/peers-schema";
import { BRIEFING_MODEL } from "@/lib/models";

export type PeersResult = { error?: string; ok?: boolean };

/**
 * Finds listed competitors and their headline figures, and caches them.
 *
 * The chat could always answer this, but it paid for the research on every
 * question and threw the result away. Cached and refreshed on demand, the cost
 * is once per stock instead of once per asking.
 *
 * Sonnet rather than Haiku: reading someone else's financial figures off a page
 * and attributing them to the right period is where a small model goes wrong
 * quietly, and a wrong number in a comparison table is worse than no table.
 */
export async function generatePeers(stockId: string): Promise<PeersResult> {
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

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: BRIEFING_MODEL,
      max_tokens: 6000,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(PeersSchema),
      },
      system: PEERS_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
      messages: [
        {
          role: "user",
          content: `Find the listed Indian peers of ${stock.symbol}${stock.name ? ` (${stock.name})` : ""}${stock.sector ? `, which operates in ${stock.sector}` : ""}, and their headline figures.`,
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return { error: "Claude declined to produce this comparison." };
    }

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { error: "Nothing came back. Try again." };
    }

    const content = PeersSchema.parse(JSON.parse(textBlock.text));

    const { error } = await supabase.from("stock_peers").upsert(
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
        cause instanceof Error ? cause.message : "Couldn't build the comparison.",
    };
  }
}
