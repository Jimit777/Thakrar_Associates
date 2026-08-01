import { extractText, getDocumentProxy } from "unpdf";
import { PDFDocument } from "pdf-lib";

/**
 * The PDF reader calls Math.sumPrecise, which this Node version doesn't have.
 * It throws internally on every page, filling the log with warnings and losing
 * whatever positioning maths depended on it. A plain sum is close enough for
 * deciding which pages to keep.
 */
const mathWithSum = Math as typeof Math & {
  sumPrecise?: (values: Iterable<number>) => number;
};

if (typeof mathWithSum.sumPrecise !== "function") {
  mathWithSum.sumPrecise = (values: Iterable<number>) => {
    let total = 0;
    for (const value of values) total += value;
    return total;
  };
}

/**
 * An annual report is mostly narrative: directors' reports, ESG sections,
 * notices. The financial statements are usually 10–30 pages of it.
 *
 * Sending the whole thing is slow, expensive, and less accurate — the model has
 * far more to sift through. This finds the statement pages by their headings and
 * builds a smaller PDF containing only those, so the user can still just upload
 * the report they downloaded.
 */

/** Headings that mark the start of a statement. */
const STRONG_MARKERS = [
  "balance sheet",
  "statement of assets and liabilities",
  "statement of profit and loss",
  "profit and loss statement",
  "statement of cash flow",
  "cash flow statement",
  "statement of changes in equity",
  "financial results",
  // Segment disclosure and the share capital note sit in the notes to accounts,
  // a long way from the statements, but both are extracted.
  "segment information",
  "segment reporting",
  "operating segments",
  "equity share capital",
];

/** Line items that appear inside the statements themselves. */
const SUPPORTING_MARKERS = [
  "revenue from operations",
  "total income",
  "total expenses",
  "profit before tax",
  "earnings per",
  "total equity and liabilities",
  "total assets",
  "cash generated from operations",
  "net cash",
  "borrowings",
  "reserves and surplus",
  "other equity",
  "segment revenue",
  "segment results",
  "reportable segment",
  "geographical segment",
  "equity shares of",
  "weighted average number",
];

export type PageSelection = {
  /** The PDF to send on: either the trimmed one, or the original unchanged. */
  bytes: Uint8Array;
  totalPages: number;
  selectedPages: number[];
  /** False when the whole document is being sent (no text layer, or no match). */
  trimmed: boolean;
  reason: string;
};

function scorePage(text: string) {
  const haystack = text.toLowerCase();
  let score = 0;

  for (const marker of STRONG_MARKERS) {
    if (haystack.includes(marker)) score += 3;
  }
  for (const marker of SUPPORTING_MARKERS) {
    if (haystack.includes(marker)) score += 1;
  }

  return score;
}

export async function selectFinancialPages(
  original: Uint8Array,
): Promise<PageSelection> {
  const fallback = (reason: string): PageSelection => ({
    bytes: original,
    totalPages: 0,
    selectedPages: [],
    trimmed: false,
    reason,
  });

  let pages: string[];
  let totalPages: number;

  try {
    const pdf = await getDocumentProxy(new Uint8Array(original));
    totalPages = pdf.numPages;
    const result = await extractText(pdf, { mergePages: false });
    pages = result.text as string[];
  } catch {
    return fallback("Couldn't read the PDF's text, so the whole file was sent.");
  }

  // A scanned report has no text layer to search — send it whole and let the
  // model read the images. Kept deliberately loose: a genuine scan has almost
  // no extractable text, so only that case should trip this.
  const withText = pages.filter((page) => page.trim().length > 20).length;
  if (withText < totalPages * 0.1) {
    return {
      ...fallback("This looks like a scanned PDF, so the whole file was sent."),
      totalPages,
    };
  }

  // Short documents are already small enough to send as-is.
  if (totalPages <= 40) {
    return {
      ...fallback("Short document — the whole file was sent."),
      totalPages,
    };
  }

  const scores = pages.map(scorePage);
  const keep = new Set<number>();

  scores.forEach((score, index) => {
    if (score < 3) return;
    // Statements run over several pages, so keep the neighbours too.
    for (let offset = -1; offset <= 2; offset++) {
      const page = index + offset;
      if (page >= 0 && page < totalPages) keep.add(page);
    }
  });

  if (keep.size === 0) {
    return {
      ...fallback(
        "No financial statement headings were found, so the whole file was sent.",
      ),
      totalPages,
    };
  }

  // If most of the document matched, trimming buys nothing.
  if (keep.size > totalPages * 0.6) {
    return {
      ...fallback("Most pages looked relevant, so the whole file was sent."),
      totalPages,
    };
  }

  const ordered = [...keep].sort((a, b) => a - b);

  try {
    const source = await PDFDocument.load(original);
    const trimmedDoc = await PDFDocument.create();
    const copied = await trimmedDoc.copyPages(source, ordered);
    copied.forEach((page) => trimmedDoc.addPage(page));
    const bytes = await trimmedDoc.save();

    return {
      bytes,
      totalPages,
      selectedPages: ordered.map((index) => index + 1),
      trimmed: true,
      reason: `Sent ${ordered.length} of ${totalPages} pages — the ones containing the financial statements.`,
    };
  } catch {
    return {
      ...fallback("Couldn't split the PDF, so the whole file was sent."),
      totalPages,
    };
  }
}
