import type { SupabaseClient } from "@supabase/supabase-js";

export type SeenAs = "holding" | "stock" | "peer";

/**
 * Records a company the app has come across.
 *
 * Called wherever a symbol surfaces — a stock you add, a peer the model names —
 * so the reference set fills up as a by-product of ordinary use. Nothing here
 * costs an API call.
 *
 * Deliberately conservative about overwriting: a name or a sector already
 * recorded is left alone, because the value already there was more likely to
 * have come from you than from a guess.
 */
export async function rememberCompanies(
  supabase: SupabaseClient,
  userId: string,
  companies: { symbol: string; name?: string | null; seenAs: SeenAs }[],
) {
  const cleaned = companies
    .map((company) => ({
      symbol: company.symbol.trim().toUpperCase(),
      name: company.name?.trim() || null,
      seenAs: company.seenAs,
    }))
    .filter((company) => company.symbol !== "");

  if (cleaned.length === 0) return;

  const { data: existing } = await supabase
    .from("companies")
    .select("symbol, name, seen_as")
    .eq("user_id", userId)
    .in(
      "symbol",
      cleaned.map((company) => company.symbol),
    );

  const known = new Map(
    (existing ?? []).map((row) => [
      row.symbol as string,
      { name: row.name as string | null, seenAs: row.seen_as as SeenAs },
    ]),
  );

  // Something you hold outranks something you research, which outranks
  // something merely named as a peer — and a company should never be demoted
  // by being mentioned again in a lesser role.
  const RANK: Record<SeenAs, number> = { holding: 3, stock: 2, peer: 1 };

  const rows = cleaned.map((company) => {
    const previous = known.get(company.symbol);

    return {
      user_id: userId,
      symbol: company.symbol,
      // Keep whatever name is already stored unless there wasn't one.
      name: previous?.name ?? company.name,
      seen_as:
        previous && RANK[previous.seenAs] > RANK[company.seenAs]
          ? previous.seenAs
          : company.seenAs,
    };
  });

  await supabase
    .from("companies")
    .upsert(rows, { onConflict: "user_id,symbol", ignoreDuplicates: false });
}
