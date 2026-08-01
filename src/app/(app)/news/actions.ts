"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  NewsDigestSchema,
  NEWS_PROMPT,
  NewsSearchSchema,
  NEWS_SEARCH_PROMPT,
  type NewsSearchResults,
} from "@/lib/news-schema";
import { BRIEFING_MODEL } from "@/lib/models";

export type NewsResult = { error?: string; ok?: boolean };

export type SearchResult =
  | { ok: true; results: NewsSearchResults }
  | { ok: false; error: string };

/**
 * Ad-hoc lookup for one stock or sector. Headlines and links only — no
 * analysis, few searches, small output. A fraction of what the digest costs,
 * because it does a fraction of the work.
 */
export async function searchNews(query: string): Promise<SearchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY is not set." };

  const cleaned = query.trim();
  if (cleaned.length < 2) return { ok: false, error: "Enter something to search for." };
  if (cleaned.length > 120) return { ok: false, error: "That search is too long." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are signed out." };

  try {
    const stream = new Anthropic({ apiKey }).messages.stream({
      model: BRIEFING_MODEL,
      max_tokens: 3000,
      output_config: { effort: "low", format: zodOutputFormat(NewsSearchSchema) },
      system: NEWS_SEARCH_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages: [
        {
          role: "user",
          content: `Find recent news about: ${cleaned}\n\nToday is ${new Date().toISOString().slice(0, 10)}.`,
        },
      ],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return { ok: false, error: "Claude declined this search." };
    }

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "No results came back." };
    }

    return { ok: true, results: NewsSearchSchema.parse(JSON.parse(textBlock.text)) };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Search failed.",
    };
  }
}

/**
 * Builds one digest covering the whole portfolio, grouped by sector. Cached —
 * it costs a search-backed model call, so it runs only when asked.
 */
export async function generateNewsDigest(): Promise<NewsResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY is not set on the server." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  // Holdings only. This is a daily feed of what bears on money actually at
  // risk — stocks merely being researched would dilute it.
  const [{ data: holdings }, { data: stocks }] = await Promise.all([
    supabase.from("holdings").select("symbol"),
    supabase.from("stocks").select("symbol, sector"),
  ]);

  // Sectors the user has already recorded in the analyzer are reused rather
  // than guessed at again.
  const sectorBySymbol = new Map(
    (stocks ?? [])
      .filter((row) => row.sector)
      .map((row) => [row.symbol as string, row.sector as string]),
  );

  const symbols = [
    ...new Set((holdings ?? []).map((row) => row.symbol as string)),
  ].sort();

  if (symbols.length === 0) {
    return { error: "Add a holding to your portfolio first." };
  }

  const roster = symbols
    .map((symbol) => {
      const sector = sectorBySymbol.get(symbol);
      return `- ${symbol}${sector ? ` (sector: ${sector})` : ""}`;
    })
    .join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const stream = client.messages.stream({
      model: BRIEFING_MODEL,
      max_tokens: 8000,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(NewsDigestSchema),
      },
      system: NEWS_PROMPT,
      // Each search pulls page content into the input, so this cap is the main
      // lever on what a digest costs.
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }],
      messages: [
        {
          role: "user",
          content: `These are the Indian listed stocks held in the portfolio. Group them by sector and build the digest.\n\n${roster}\n\nToday is ${new Date().toISOString().slice(0, 10)}. Cover roughly the last week — this is read daily, so older items will already have been seen.`,
        },
      ],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return { error: "Claude declined to build this digest." };
    }

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { error: "No digest came back. Try again." };
    }

    const content = NewsDigestSchema.parse(JSON.parse(textBlock.text));

    const { error } = await supabase.from("news_digests").upsert(
      {
        user_id: user.id,
        content,
        symbols,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) return { error: error.message };

    revalidatePath("/news");
    return { ok: true };
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : "Couldn't build the digest.",
    };
  }
}
