"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractFinancialsFromPdf } from "@/lib/anthropic";
import { resolveExtractionModel } from "@/lib/models";
import { selectFinancialPages } from "@/lib/pdf-sections";
import type { Extraction, ExtractedPeriod } from "@/lib/extraction-schema";

export type ExtractResult =
  | {
      ok: true;
      extraction: Extraction;
      model: string;
      filtered: { expected: "annual" | "quarterly" | null; dropped: number };
      pageInfo: { trimmed: boolean; reason: string; selectedPages: number[]; totalPages: number };
    }
  | { ok: false; error: string };

/**
 * Reads an uploaded PDF and asks Claude for its figures. Nothing is written to
 * the database here — the result goes back to the user for review first.
 */
export async function extractFinancials(
  documentId: string,
  requestedModel?: string,
): Promise<ExtractResult> {
  const model = resolveExtractionModel(requestedModel);
  const supabase = await createClient();

  const { data: document, error } = await supabase
    .from("documents")
    .select("id, kind, period_label, storage_path, stock_id, stocks(symbol)")
    .eq("id", documentId)
    .single<{
      id: string;
      kind: string;
      period_label: string;
      storage_path: string;
      stock_id: string;
      stocks: { symbol: string } | null;
    }>();

  if (error || !document) return { ok: false, error: "Document not found." };

  const { data: file, error: downloadError } = await supabase.storage
    .from("documents")
    .download(document.storage_path);

  if (downloadError || !file) {
    return { ok: false, error: "Couldn't read the stored file." };
  }

  // Narrow a long annual report down to its financial statements before
  // sending. Falls back to the whole file whenever that isn't possible.
  const selection = await selectFinancialPages(
    new Uint8Array(await file.arrayBuffer()),
  );

  const pdfBase64 = Buffer.from(selection.bytes).toString("base64");

  // The API caps a request at 32 MB, and base64 inflates the file by ~33%.
  if (pdfBase64.length > 31_000_000) {
    return {
      ok: false,
      error:
        "Even after narrowing it down, this PDF is too large to read in one request. Try uploading the financial statements section on its own.",
    };
  }

  try {
    const extraction = await extractFinancialsFromPdf(
      pdfBase64,
      {
        symbol: document.stocks?.symbol ?? "this company",
        periodLabel: document.period_label,
        kind: document.kind,
      },
      model,
    );
    // Enforced rather than trusted to the model. Only quarterly filings are
    // filtered: their Q4 editions print full-year figures that would compete
    // with the annual report's. An annual report's quarterly tables compete
    // with nothing, so they are kept.
    const expected =
      document.kind === "quarterly_result" ? ("quarterly" as const) : null;

    const kept = expected
      ? extraction.periods.filter((period) => period.period_type === expected)
      : extraction.periods;

    const dropped = extraction.periods.length - kept.length;

    return {
      ok: true,
      extraction: { ...extraction, periods: kept },
      model,
      filtered: { expected, dropped },
      pageInfo: {
        trimmed: selection.trimmed,
        reason: selection.reason,
        selectedPages: selection.selectedPages,
        totalPages: selection.totalPages,
      },
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Extraction failed.";
    return { ok: false, error: message };
  }
}

export type SaveFinancialsInput = {
  stockId: string;
  documentId: string;
  currencyUnit: string;
  basis: "consolidated" | "standalone" | "unknown";
  periods: ExtractedPeriod[];
};

/** Saves the figures the user has reviewed and confirmed. */
export async function saveFinancials(
  input: SaveFinancialsInput,
): Promise<{ error?: string; saved?: number }> {
  if (input.periods.length === 0) return { error: "Nothing to save." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const rows = input.periods.map((period) => {
    const { period_label, period_type, ...figures } = period;

    return {
      user_id: user.id,
      stock_id: input.stockId,
      source_document_id: input.documentId,
      period_type,
      period_label,
      basis: input.basis,
      currency_unit: input.currencyUnit,
      data: figures,
    };
  });

  // Re-confirming a period replaces the previous figures for it.
  const { error } = await supabase
    .from("financials")
    .upsert(rows, { onConflict: "stock_id,period_label,basis" });

  if (error) return { error: error.message };

  revalidatePath("/analyzer");
  return { saved: rows.length };
}

export async function deleteFinancialRow(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("financials").delete().eq("id", id);

  revalidatePath("/analyzer");
}
