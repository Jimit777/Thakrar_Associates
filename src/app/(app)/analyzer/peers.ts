"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PeersSchema, PEERS_PROMPT } from "@/lib/peers-schema";
import { generateStructured } from "@/lib/gemini";
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
 * The smallest tier is enough for that, and the peer list changes rarely, so
 * it is cached and only rebuilt when asked.
 */
export async function generatePeers(stockId: string): Promise<PeersResult> {
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

  try {
    const content = await generateStructured({
      tier: "lite",
      system: PEERS_PROMPT,
      prompt: `Name the listed Indian companies that ${stock.symbol}${stock.name ? ` (${stock.name})` : ""}${stock.sector ? `, which operates in ${stock.sector}` : ""} genuinely competes with.`,
      schema: PeersSchema,
      search: true,
      maxOutputTokens: 2000,
    });

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
