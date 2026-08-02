"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rememberCompanies } from "@/lib/companies";
import { KEY_POINTS_MODEL } from "@/lib/models";
import { SectorAssignmentsSchema, SECTOR_PROMPT } from "@/lib/sectors";

export type ClassifyResult = { error?: string; classified?: number };

/**
 * Works out a sector for every holding that doesn't have one.
 *
 * All of them in a single call: classifying twenty companies costs barely more
 * than classifying one, and the answer is stored per company so it is never
 * paid for twice. A sector you set yourself is left alone.
 */
export async function classifySectors(): Promise<ClassifyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY is not set on the server." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const [{ data: holdings }, { data: companies }] = await Promise.all([
    supabase.from("holdings").select("symbol"),
    supabase.from("companies").select("symbol, name, sector"),
  ]);

  // Anything held gets a row, so a holding added before this existed is not
  // stranded outside the reference set.
  await rememberCompanies(
    supabase,
    user.id,
    (holdings ?? []).map((row) => ({
      symbol: row.symbol as string,
      seenAs: "holding" as const,
    })),
  );

  const sectorBySymbol = new Map(
    (companies ?? []).map((row) => [row.symbol as string, row.sector as string | null]),
  );
  const nameBySymbol = new Map(
    (companies ?? []).map((row) => [row.symbol as string, row.name as string | null]),
  );

  const pending = [
    ...new Set((holdings ?? []).map((row) => row.symbol as string)),
  ].filter((symbol) => !sectorBySymbol.get(symbol));

  if (pending.length === 0) return { classified: 0 };

  const roster = pending
    .map((symbol) => {
      const name = nameBySymbol.get(symbol);
      return `- ${symbol}${name ? ` (${name})` : ""}`;
    })
    .join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: KEY_POINTS_MODEL,
      max_tokens: 2000,
      output_config: { format: zodOutputFormat(SectorAssignmentsSchema) },
      system: SECTOR_PROMPT,
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 2,
          allowed_callers: ["direct"],
        },
      ],
      messages: [
        {
          role: "user",
          content: `Classify these Indian listed companies:\n\n${roster}`,
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return { error: "Claude declined to classify these." };
    }

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { error: "Nothing came back. Try again." };
    }

    const { assignments } = SectorAssignmentsSchema.parse(
      JSON.parse(textBlock.text),
    );

    // Only the ones actually asked about — a symbol we didn't send back is not
    // something to write.
    const wanted = new Set(pending);
    const toWrite = assignments.filter((entry) =>
      wanted.has(entry.symbol.trim().toUpperCase()),
    );

    for (const entry of toWrite) {
      const symbol = entry.symbol.trim().toUpperCase();

      await supabase
        .from("companies")
        .update({ sector: entry.sector, sector_source: "derived" })
        .eq("user_id", user.id)
        .eq("symbol", symbol);

      // Mirror it onto the researched stock too, where the user can see and
      // correct it — but never over a sector they typed themselves.
      await supabase
        .from("stocks")
        .update({ sector: entry.sector })
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .is("sector", null);
    }

    revalidatePath("/");
    revalidatePath("/analyzer");
    return { classified: toWrite.length };
  } catch (cause) {
    return {
      error:
        cause instanceof Error ? cause.message : "Couldn't classify the sectors.",
    };
  }
}
