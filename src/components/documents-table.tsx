import { ExtractionReview } from "@/components/extraction-review";
import { deleteDocument } from "@/app/(app)/analyzer/actions";
import { DOCUMENT_KIND_LABELS, type StockDocument } from "@/types/stock";

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function DeleteButton({ doc }: { doc: StockDocument }) {
  return (
    <form action={deleteDocument} className="inline">
      <input type="hidden" name="id" value={doc.id} />
      <input type="hidden" name="storage_path" value={doc.storage_path} />
      <button
        type="submit"
        className="rounded border border-border px-2 py-1 text-xs transition-colors hover:border-negative hover:text-negative"
      >
        Delete
      </button>
    </form>
  );
}

/** Cards on a phone, a table from `md` up — file names are too long to fit six
 *  columns on a narrow screen. */
export function DocumentsTable({
  documents,
  stockId,
}: {
  documents: StockDocument[];
  stockId: string;
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <p className="text-sm font-medium break-words">{doc.file_name}</p>
            <p className="mt-1 text-xs text-muted">
              {DOCUMENT_KIND_LABELS[doc.kind]} · {doc.period_label}
            </p>
            <p className="figure mt-0.5 text-xs text-muted">
              {formatFileSize(doc.file_size_bytes)} ·{" "}
              {formatDate(doc.created_at)}
            </p>

            <div className="mt-3 flex flex-wrap items-start gap-2">
              <ExtractionReview
                documentId={doc.id}
                stockId={stockId}
                label={`${doc.file_name} (${doc.period_label})`}
              />
              <DeleteButton doc={doc} />
            </div>
          </div>
        ))}
      </div>

      <div className="scroll-x hidden rounded-lg border border-border md:block">
        <table className="w-full min-w-2xl border-collapse bg-surface">
          <thead>
            <tr className="border-b border-border bg-surface-sunken text-left">
              <th className="stat-label px-4 py-3">Document</th>
              <th className="stat-label px-4 py-3">Type</th>
              <th className="stat-label px-4 py-3">Period</th>
              <th className="stat-label px-4 py-3 text-right">Size</th>
              <th className="stat-label px-4 py-3">Uploaded</th>
              <th className="stat-label px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-sm font-medium">
                  {doc.file_name}
                </td>
                <td className="px-4 py-3 text-sm text-muted">
                  {DOCUMENT_KIND_LABELS[doc.kind]}
                </td>
                <td className="figure px-4 py-3 text-sm">{doc.period_label}</td>
                <td className="figure px-4 py-3 text-right text-sm text-muted">
                  {formatFileSize(doc.file_size_bytes)}
                </td>
                <td className="figure px-4 py-3 text-sm text-muted">
                  {formatDate(doc.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-start justify-end gap-2">
                    <ExtractionReview
                      documentId={doc.id}
                      stockId={stockId}
                      label={`${doc.file_name} (${doc.period_label})`}
                    />
                    <DeleteButton doc={doc} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
