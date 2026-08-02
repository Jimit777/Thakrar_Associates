import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NewsDigestSchema, NEWS_PROMPT } from "@/lib/news-schema";
import { BRIEFING_MODEL } from "@/lib/models";

/**
 * Builds one user's news digest and saves it.
 *
 * Lifted out of the server action so the nightly cron can call it too. It takes
 * a client and a user id rather than reading the session, because a cron job
 * has no session — it runs with a service-role client and does the filtering
 * itself.
 */
export async function buildDigest(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ error?: string; ok?: boolean; symbols?: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY is not set on the server." };

  // Holdings only. This is a feed of what bears on money actually at risk —
  // stocks merely being researched would dilute it.
  const [{ data: holdings }, { data: stocks }] = await Promise.all([
    supabase.from("holdings").select("symbol").eq("user_id", userId),
    supabase.from("stocks").select("symbol, sector").eq("user_id", userId),
  ]);

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
        user_id: userId,
        content,
        symbols,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) return { error: error.message };

    return { ok: true, symbols };
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : "Couldn't build the digest.",
    };
  }
}
