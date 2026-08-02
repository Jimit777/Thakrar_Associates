"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  NewsSearchSchema,
  NEWS_SEARCH_PROMPT,
  type NewsSearchResults,
} from "@/lib/news-schema";
import { BRIEFING_MODEL } from "@/lib/models";
import { buildDigest } from "@/lib/digest";

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
 * Rebuilds the signed-in user's digest on demand. The work itself lives in
 * lib/digest so the nightly cron can run exactly the same code.
 */
export async function generateNewsDigest(): Promise<NewsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const result = await buildDigest(supabase, user.id);
  if (result.error) return { error: result.error };

  revalidatePath("/news");
  return { ok: true };
}
