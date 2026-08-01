import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normaliseFigures } from "@/types/financial";

/**
 * Opens the report a saved period was read from, at the page it was read from.
 *
 * A redirect rather than a server action: the browser follows it in the tab the
 * link opened, so there is no popup to be blocked, and the signed URL never
 * needs to sit in the page's HTML waiting to expire.
 *
 * Row Level Security does the authorisation — a row belonging to another user
 * simply isn't returned.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("financials")
    .select("source_document_id, data")
    .eq("id", id)
    .maybeSingle<{ source_document_id: string | null; data: unknown }>();

  if (!row?.source_document_id) {
    return NextResponse.json(
      { error: "No source document is recorded for these figures." },
      { status: 404 },
    );
  }

  const { data: document } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", row.source_document_id)
    .maybeSingle<{ storage_path: string }>();

  if (!document) {
    return NextResponse.json(
      { error: "The source document has been deleted." },
      { status: 404 },
    );
  }

  const { data: signed, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(document.storage_path, 300);

  if (error || !signed) {
    return NextResponse.json(
      { error: "Couldn't open the stored file." },
      { status: 500 },
    );
  }

  // Page numbers refer to the original upload, which is what is stored — the
  // trimmed copy sent to the model is never saved.
  const pages = normaliseFigures(row.data).source_pages ?? [];
  const firstPage = pages[0];

  return NextResponse.redirect(
    firstPage ? `${signed.signedUrl}#page=${firstPage}` : signed.signedUrl,
  );
}
