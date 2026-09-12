"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateStructured } from "@/lib/gemini";
import {
  ConcallSummarySchema,
  CONCALL_PROMPT,
  type ConcallSummary,
} from "@/lib/concall-schema";

export type ConcallResult =
  | { ok: true; summary: ConcallSummary }
  | { ok: false; error: string };

/**
 * Reads a concall transcript and summarises it.
 *
 * Unlike a financial report, the whole transcript is relevant — there is no
 * section to narrow down to, so the page-selection step is skipped.
 */
export async function summariseConcall(documentId: string): Promise<ConcallResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are signed out." };

  const { data: document } = await supabase
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

  if (!document) return { ok: false, error: "Document not found." };

  const { data: file, error: downloadError } = await supabase.storage
    .from("documents")
    .download(document.storage_path);

  if (downloadError || !file) {
    return { ok: false, error: "Couldn't read the stored file." };
  }

  const pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  // Gemini's inline request body is capped around 20 MB; a larger file would
  // need the separate files.upload() path, which nothing here implements yet.
  if (pdfBase64.length > 19_000_000) {
    return { ok: false, error: "This transcript is too large to read in one request." };
  }

  try {
    const summary = await generateStructured({
      tier: "pro",
      system: CONCALL_PROMPT,
      prompt: `Earnings call transcript for ${document.stocks?.symbol ?? "this company"}, labelled ${document.period_label}. Summarise it.`,
      pdfs: [{ base64: pdfBase64 }],
      schema: ConcallSummarySchema,
      thinking: "medium",
      maxOutputTokens: 8000,
    });

    const { error } = await supabase.from("concall_summaries").upsert(
      {
        document_id: document.id,
        user_id: user.id,
        stock_id: document.stock_id,
        period_label: document.period_label,
        content: summary,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "document_id" },
    );

    if (error) return { ok: false, error: error.message };

    revalidatePath("/analyzer");
    return { ok: true, summary };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Couldn't summarise the call.",
    };
  }
}

export async function deleteConcallSummary(formData: FormData) {
  const documentId = String(formData.get("document_id") ?? "");
  if (!documentId) return;

  const supabase = await createClient();
  await supabase.from("concall_summaries").delete().eq("document_id", documentId);

  revalidatePath("/analyzer");
}
