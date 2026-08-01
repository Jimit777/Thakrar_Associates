"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordDocument } from "@/app/(app)/analyzer/actions";
import {
  DOCUMENT_KIND_LABELS,
  MAX_UPLOAD_BYTES,
  type DocumentKind,
} from "@/types/stock";

const fieldClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

export function DocumentUpload({
  stockId,
  userId,
}: {
  stockId: string;
  userId: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const file = formData.get("file") as File | null;
    const kind = String(formData.get("kind") ?? "annual_report") as DocumentKind;
    const periodLabel = String(formData.get("period_label") ?? "").trim();

    if (!file || file.size === 0) return setError("Choose a PDF to upload.");
    if (file.type !== "application/pdf") return setError("Only PDF files are supported.");
    if (file.size > MAX_UPLOAD_BYTES) {
      return setError(
        "That file is over 20 MB, which is more than the AI can read in one go. Split it, or upload just the financial statements pages.",
      );
    }
    if (!periodLabel) return setError("Enter which period this covers.");

    setBusy(true);
    try {
      // Upload straight from the browser to storage. The path starts with the
      // user's id, which is what the storage security rules check.
      const supabase = createClient();
      const storagePath = `${userId}/${stockId}/${crypto.randomUUID()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, { contentType: "application/pdf" });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const result = await recordDocument({
        stockId,
        kind,
        periodLabel,
        storagePath,
        fileName: file.name,
        fileSizeBytes: file.size,
      });

      if (result.error) {
        // Saving the details failed, so don't leave an orphaned file behind.
        await supabase.storage.from("documents").remove([storagePath]);
        setError(result.error);
        return;
      }

      formRef.current?.reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="rounded-lg border border-border bg-surface p-4 sm:p-5"
    >
      <h2 className="text-base font-medium">Upload a report</h2>
      <p className="mt-1 text-sm text-muted">
        Annual reports, quarterly results, or concall transcripts as PDF.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="stat-label">Document type</span>
          <select name="kind" defaultValue="annual_report" className={fieldClass}>
            {Object.entries(DOCUMENT_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="stat-label">Period</span>
          <input
            name="period_label"
            required
            placeholder="FY2024 or Q2 FY2025"
            autoComplete="off"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="stat-label">PDF file</span>
          <input
            name="file"
            type="file"
            accept="application/pdf"
            required
            className={`${fieldClass} file:mr-3 file:rounded file:border-0 file:bg-surface-sunken file:px-2 file:py-1 file:text-xs file:text-foreground`}
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-negative">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
