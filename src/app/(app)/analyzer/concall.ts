"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ConcallSummarySchema,
  CONCALL_PROMPT,
  type ConcallSummary,
} from "@/lib/concall-schema";
import { BRIEFING_MODEL } from "@/lib/models";

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY is not set." };

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

  if (pdfBase64.length > 31_000_000) {
    return { ok: false, error: "This transcript is too large to read in one request." };
  }

  try {
    const stream = client(apiKey).messages.stream({
      model: BRIEFING_MODEL,
      // Generous, because internal reasoning shares this ceiling with the
      // output — the brevity limits live in the schema and prompt.
      max_tokens: 8000,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(ConcallSummarySchema),
      },
      system: CONCALL_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: `Earnings call transcript for ${document.stocks?.symbol ?? "this company"}, labelled ${document.period_label}. Summarise it.`,
            },
          ],
        },
      ],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return { ok: false, error: "Claude declined to summarise this transcript." };
    }

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "No summary came back. Try again." };
    }

    const summary = ConcallSummarySchema.parse(JSON.parse(textBlock.text));

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

function client(apiKey: string) {
  return new Anthropic({ apiKey });
}

export async function deleteConcallSummary(formData: FormData) {
  const documentId = String(formData.get("document_id") ?? "");
  if (!documentId) return;

  const supabase = await createClient();
  await supabase.from("concall_summaries").delete().eq("document_id", documentId);

  revalidatePath("/analyzer");
}
