import { PageHeading, EmptyState } from "@/components/page-heading";
import { NewsDigestView } from "@/components/news-digest";
import { createClient } from "@/lib/supabase/server";
import type { NewsDigest } from "@/lib/news-schema";

// Searching and summarising the news takes a while.
export const maxDuration = 300;

export default async function NewsPage() {
  const supabase = await createClient();

  const [{ data: holdings }, { data: stocks }, { data: digestRow }] =
    await Promise.all([
      supabase.from("holdings").select("symbol"),
      supabase.from("stocks").select("symbol"),
      supabase
        .from("news_digests")
        .select("content, symbols, generated_at")
        .maybeSingle<{
          content: unknown;
          symbols: string[];
          generated_at: string;
        }>(),
    ]);

  const currentSymbols = [
    ...new Set([
      ...(holdings ?? []).map((row) => row.symbol as string),
      ...(stocks ?? []).map((row) => row.symbol as string),
    ]),
  ].sort();

  return (
    <>
      <PageHeading
        title="News"
        subtitle="Look anything up, or see what moved across your holdings."
      />

      {currentSymbols.length === 0 ? (
        <EmptyState
          title="Nothing to follow yet"
          description="Add a holding to your portfolio or a stock to the analyzer, then build a digest."
        />
      ) : (
        <NewsDigestView
          digest={(digestRow?.content as NewsDigest | undefined) ?? null}
          generatedAt={digestRow?.generated_at ?? null}
          coveredSymbols={digestRow?.symbols ?? []}
          currentSymbols={currentSymbols}
        />
      )}
    </>
  );
}
