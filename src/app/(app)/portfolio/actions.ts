"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Exchange } from "@/types/holding";

export type HoldingFormState = { error?: string; success?: boolean };

type ParsedHolding = {
  symbol: string;
  exchange: Exchange;
  quantity: number;
  avg_price: number;
  buy_date: string | null;
};

/**
 * Validates the submitted form. Returns either clean values or a message to
 * show the user — the database has matching checks, but catching mistakes here
 * gives a far friendlier error.
 */
function parseHolding(formData: FormData): ParsedHolding | string {
  const symbol = String(formData.get("symbol") ?? "")
    .trim()
    .toUpperCase();
  const exchange = String(formData.get("exchange") ?? "NSE") as Exchange;
  const quantity = Number(formData.get("quantity"));
  const avgPrice = Number(formData.get("avg_price"));
  const buyDate = String(formData.get("buy_date") ?? "").trim();

  if (!symbol) return "Enter a stock symbol.";
  if (!/^[A-Z0-9&.-]{1,20}$/.test(symbol)) {
    return "That symbol doesn't look right. Use the exchange ticker, e.g. RELIANCE.";
  }
  if (exchange !== "NSE" && exchange !== "BSE") return "Choose NSE or BSE.";
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Quantity must be a number greater than zero.";
  }
  if (!Number.isFinite(avgPrice) || avgPrice < 0) {
    return "Average price must be zero or more.";
  }

  return {
    symbol,
    exchange,
    quantity,
    avg_price: avgPrice,
    buy_date: buyDate || null,
  };
}

export async function addHolding(
  _prevState: HoldingFormState,
  formData: FormData,
): Promise<HoldingFormState> {
  const parsed = parseHolding(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const { error } = await supabase
    .from("holdings")
    .insert({ ...parsed, user_id: user.id });

  if (error) {
    // 23505 is Postgres' "unique constraint violated".
    if (error.code === "23505") {
      return {
        error: `${parsed.symbol} is already in your portfolio. Edit that row instead.`,
      };
    }
    return { error: error.message };
  }

  revalidatePath("/portfolio");
  revalidatePath("/");
  return { success: true };
}

export async function updateHolding(
  _prevState: HoldingFormState,
  formData: FormData,
): Promise<HoldingFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing holding id." };

  const parsed = parseHolding(formData);
  if (typeof parsed === "string") return { error: parsed };

  const supabase = await createClient();

  // Editing the quantity or price makes any stored price total stale, so the
  // saved price is cleared and must be refreshed again.
  const { error } = await supabase
    .from("holdings")
    .update({ ...parsed, last_price: null, last_refreshed_at: null })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/portfolio");
  revalidatePath("/");
  return { success: true };
}

export async function deleteHolding(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("holdings").delete().eq("id", id);

  revalidatePath("/portfolio");
  revalidatePath("/");
}
