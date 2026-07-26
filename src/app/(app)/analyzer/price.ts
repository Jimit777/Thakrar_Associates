"use server";

import {
  fetchPriceHistory,
  PRICE_RANGES,
  type PriceHistory,
  type PriceRangeId,
} from "@/lib/prices";

export type PriceResult =
  | { ok: true; history: PriceHistory }
  | { ok: false; error: string };

const MIN_CUSTOM_DAYS = 28; // a custom window must span at least a month

function isValidRange(value: unknown): value is PriceRangeId {
  return PRICE_RANGES.some((entry) => entry.id === value);
}

export async function getPriceHistory(
  symbol: string,
  selection: { range?: string; from?: string; to?: string },
): Promise<PriceResult> {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9&.-]{1,20}$/.test(cleanSymbol)) {
    return { ok: false, error: "That symbol doesn't look right." };
  }

  let query: Parameters<typeof fetchPriceHistory>[1];

  if (selection.from && selection.to) {
    const from = new Date(selection.from);
    const to = new Date(selection.to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return { ok: false, error: "Enter both dates." };
    }
    if (to <= from) {
      return { ok: false, error: "The end date must be after the start date." };
    }
    if ((to.getTime() - from.getTime()) / 86_400_000 < MIN_CUSTOM_DAYS) {
      return { ok: false, error: "Choose a range of at least one month." };
    }
    if (to > new Date()) {
      return { ok: false, error: "The end date can't be in the future." };
    }

    query = { from: selection.from, to: selection.to };
  } else if (isValidRange(selection.range)) {
    query = { range: selection.range };
  } else {
    return { ok: false, error: "Choose a time range." };
  }

  const history = await fetchPriceHistory(cleanSymbol, query);

  if (!history) {
    return {
      ok: false,
      error: `No price history found for ${cleanSymbol} on NSE or BSE.`,
    };
  }

  return { ok: true, history };
}
