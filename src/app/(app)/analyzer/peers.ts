"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PeersSchema, PEERS_PROMPT } from "@/lib/peers-schema";
import { KEY_POINTS_MODEL } from "@/lib/models";
import { rememberCompanies } from "@/lib/companies";

export type PeersResult = { error?: string; ok?: boolean };

/**
 * Names the listed competitors, and nothing else.
 *
 * Their figures used to come from here too, which meant ten searches and a
 * minute of waiting to produce a table with holes in it. The measurable part
 * now comes from the price feed instead — one request per company, exact, and
 * free — so this call shrank to a short list of names and tickers.
 *
 * Haiku is enough for that, and the peer list changes rarely, so it is cached
 * and only rebuilt when asked.
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
      model: KEY_POINTS_MODEL,
      // A list of names and tickers is a short answer. Haiku takes no effort
      // parameter, and the ceiling is what keeps this quick.
      max_tokens: 2000,
      output_config: { format: zodOutputFormat(PeersSchema) },
      system: PEERS_PROMPT,
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 3,
          allowed_callers: ["direct"],
        },
      ],
      messages: [
        {
          role: "user",
          content: `Name the listed Indian companies that ${stock.symbol}${stock.name ? ` (${stock.name})` : ""}${stock.sector ? `, which operates in ${stock.sector}` : ""} genuinely competes with.`,
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

    // Every company named here joins the reference set, so a peer you later
    // decide to research is already known — name, and eventually sector.
    await rememberCompanies(supabase, user.id, [
      { symbol: stock.symbol, name: stock.name, seenAs: "stock" },
      ...content.peers.map((peer) => ({
        symbol: peer.symbol,
        name: peer.name,
        seenAs: "peer" as const,
      })),
    ]);

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
