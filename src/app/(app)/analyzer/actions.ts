"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rememberCompanies } from "@/lib/companies";
import type { DocumentKind } from "@/types/stock";

export type StockFormState = { error?: string; success?: boolean };

export async function addStock(
  _prevState: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  const symbol = String(formData.get("symbol") ?? "")
    .trim()
    .toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const sector = String(formData.get("sector") ?? "").trim();

  if (!symbol) return { error: "Enter a stock symbol." };
  if (!/^[A-Z0-9&.-]{1,20}$/.test(symbol)) {
    return { error: "That symbol doesn't look right. Use the exchange ticker." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const { error } = await supabase.from("stocks").insert({
    user_id: user.id,
    symbol,
    name: name || null,
    sector: sector || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `${symbol} is already in your analyzer.` };
    }
    return { error: error.message };
  }

  await rememberCompanies(supabase, user.id, [
    { symbol, name: name || null, seenAs: "stock" },
  ]);

  // A sector typed here is the user's own, so it is recorded as such and never
  // overwritten by the classifier later.
  if (sector) {
    await supabase
      .from("companies")
      .update({ sector, sector_source: "user" })
      .eq("user_id", user.id)
      .eq("symbol", symbol);
  }

  revalidatePath("/analyzer");
  revalidatePath("/");
  return { success: true };
}

export async function deleteStock(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();

  // Remove the stored PDFs first — deleting the row cascades in the database
  // but leaves the files behind in storage.
  const { data: documents } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("stock_id", id);

  const paths = (documents ?? []).map((doc) => doc.storage_path);
  if (paths.length > 0) {
    await supabase.storage.from("documents").remove(paths);
  }

  await supabase.from("stocks").delete().eq("id", id);

  revalidatePath("/analyzer");
}

export type RecordDocumentInput = {
  stockId: string;
  kind: DocumentKind;
  periodLabel: string;
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
};

/**
 * Saves the details of a file the browser has already uploaded to storage.
 * The upload itself happens browser-to-Supabase so large PDFs never pass
 * through the server.
 */
export async function recordDocument(
  input: RecordDocumentInput,
): Promise<{ error?: string }> {
  const periodLabel = input.periodLabel.trim();
  if (!periodLabel) return { error: "Enter which period this covers." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const { error } = await supabase.from("documents").insert({
    user_id: user.id,
    stock_id: input.stockId,
    kind: input.kind,
    period_label: periodLabel,
    storage_path: input.storagePath,
    file_name: input.fileName,
    file_size_bytes: input.fileSizeBytes,
  });

  if (error) return { error: error.message };

  revalidatePath("/analyzer");
  return {};
}

export async function deleteDocument(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");
  if (!id) return;

  const supabase = await createClient();

  if (storagePath) {
    await supabase.storage.from("documents").remove([storagePath]);
  }
  await supabase.from("documents").delete().eq("id", id);

  revalidatePath("/analyzer");
}
