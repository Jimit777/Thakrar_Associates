"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  extractFinancials,
  saveFinancials,
} from "@/app/(app)/analyzer/extract";
import {
  SECTIONS,
  type Extraction,
  type ExtractedPeriod,
} from "@/lib/extraction-schema";
import {
  DEFAULT_EXTRACTION_MODEL,
  EXTRACTION_MODELS,
  type ExtractionModelId,
} from "@/lib/models";
import { sortByPeriod } from "@/lib/periods";

type Props = {
  documentId: string;
  stockId: string;
  label: string;
};

type SectionKey = (typeof SECTIONS)[number]["key"];

const inputClass =
  "w-28 rounded border border-border bg-background px-2 py-1 text-right text-sm outline-none focus:border-accent";

/** Turns [39,40,41,87,88] into "39–41, 87–88". */
function formatPageList(pages: number[]) {
  const ranges: string[] = [];
  let start = pages[0];
  let previous = pages[0];

  for (const page of pages.slice(1)) {
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
    start = page;
    previous = page;
  }
  ranges.push(start === previous ? `${start}` : `${start}–${previous}`);

  return ranges.join(", ");
}

export function ExtractionReview({ documentId, stockId, label }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Extraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [model, setModel] = useState<ExtractionModelId>(DEFAULT_EXTRACTION_MODEL);
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<{
    trimmed: boolean;
    reason: string;
    selectedPages: number[];
    totalPages: number;
  } | null>(null);
  const [filtered, setFiltered] = useState<{
    expected: "annual" | "quarterly" | null;
    dropped: number;
  } | null>(null);

  function runExtraction() {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await extractFinancials(documentId, model);
      if (result.ok) {
        // Show the columns oldest to newest, matching the saved table.
        setDraft({
          ...result.extraction,
          periods: sortByPeriod(result.extraction.periods),
        });
        setUsedModel(result.model);
        setPageInfo(result.pageInfo);
        setFiltered(result.filtered);
      } else {
        setError(result.error);
      }
    });
  }

  function updateFigure(
    index: number,
    section: SectionKey,
    key: string,
    raw: string,
  ) {
    setDraft((current) => {
      if (!current) return current;
      const periods = [...current.periods];
      const period = periods[index];
      const trimmed = raw.trim();

      periods[index] = {
        ...period,
        [section]: {
          ...period[section],
          [key]: trimmed === "" ? null : Number(trimmed),
        },
      } as ExtractedPeriod;

      return { ...current, periods };
    });
  }

  /**
   * Share count is the figure most often read in the wrong scale — "6.5 crore
   * shares" coming back as 6.5 — so it is editable here rather than only
   * flagged later on the stock page.
   */
  function updateShares(index: number, raw: string) {
    setDraft((current) => {
      if (!current) return current;
      const periods = [...current.periods];
      const trimmed = raw.trim();
      periods[index] = {
        ...periods[index],
        shares_outstanding: trimmed === "" ? null : Number(trimmed),
      };
      return { ...current, periods };
    });
  }

  function updateBasis(index: number, basis: string) {
    setDraft((current) => {
      if (!current) return current;
      const periods = [...current.periods];
      periods[index] = {
        ...periods[index],
        basis: basis as ExtractedPeriod["basis"],
      };
      return { ...current, periods };
    });
  }

  function removePeriod(index: number) {
    setDraft((current) =>
      current
        ? { ...current, periods: current.periods.filter((_, i) => i !== index) }
        : current,
    );
  }

  function confirm() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const result = await saveFinancials({
        stockId,
        documentId,
        currencyUnit: draft.currency_unit,
        periods: draft.periods,
        sourcePages: pageInfo?.selectedPages ?? [],
      });
      if (result.error) setError(result.error);
      else {
        setSaved(result.saved ?? 0);
        setDraft(null);
        router.refresh();
      }
    });
  }

  if (!draft) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(event) => setModel(event.target.value as ExtractionModelId)}
            disabled={pending}
            title={EXTRACTION_MODELS.find((option) => option.id === model)?.note}
            className="rounded border border-border bg-surface px-1.5 py-1 text-xs outline-none focus:border-accent"
          >
            {EXTRACTION_MODELS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={runExtraction}
            disabled={pending}
            className="rounded border border-border px-2 py-1 text-xs transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {pending ? "Reading…" : "Extract figures"}
          </button>
        </div>

        {error && <p className="max-w-xs text-right text-xs text-negative">{error}</p>}
        {saved !== null && (
          <p className="text-xs text-positive">
            Saved {saved} period{saved === 1 ? "" : "s"}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Review extracted figures</h2>
            <p className="mt-1 text-sm text-muted">
              From {label}. Nothing is saved until you confirm — correct anything
              that looks wrong first.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent"
          >
            Discard
          </button>
        </header>

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="stat-label">Unit</span>
            <input
              value={draft.currency_unit}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? { ...current, currency_unit: event.target.value }
                    : current,
                )
              }
              placeholder="INR crore"
              className="figure w-40 rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
            />
          </label>

          <span className="pb-1 text-muted">
            Periods found{" "}
            <span className="figure text-foreground">{draft.periods.length}</span>
          </span>
          {usedModel && (
            <span className="pb-1 text-muted">
              Read by{" "}
              <span className="text-foreground">
                {EXTRACTION_MODELS.find((option) => option.id === usedModel)?.label ??
                  usedModel}
              </span>
            </span>
          )}
        </div>

        {draft.periods.some((period) => period.basis === "unknown") && (
          <p className="mt-3 rounded-md border border-negative/40 bg-surface-sunken p-3 text-sm">
            Some periods came back without a clear reporting basis. Set them
            below if you know which they are — saving as &ldquo;unknown&rdquo;
            makes them hard to compare later.
          </p>
        )}

        {(() => {
          // The same period appearing twice under different bases is normal —
          // consolidated and standalone are different sets of figures. The same
          // period appearing twice where one is "unknown" usually is not: it is
          // the sign of a summary table having been read alongside the audited
          // statements, and its numbers will not agree.
          const suspect = [
            ...new Set(
              draft.periods
                .filter((period) => period.basis === "unknown")
                .filter((period) =>
                  draft.periods.some(
                    (other) =>
                      other !== period &&
                      other.period_label === period.period_label &&
                      other.period_type === period.period_type &&
                      other.basis !== "unknown",
                  ),
                )
                .map((period) => period.period_label),
            ),
          ];

          if (suspect.length === 0) return null;

          return (
            <p className="mt-3 rounded-md border border-negative/40 bg-surface-sunken p-3 text-sm leading-relaxed">
              <span className="stat-label text-negative">
                Check {suspect.join(", ")} before saving
              </span>
              <br />
              <span className="text-muted">
                {suspect.length === 1 ? "This period appears" : "These periods appear"}{" "}
                twice — once with a stated basis and once as
                &ldquo;unknown&rdquo;. That usually means a summary or
                highlights table was read alongside the audited statements, and
                its figures will not match. Compare the columns, then remove the
                unknown one with the × above it unless you can tell what it is.
              </span>
            </p>
          );
        })()}

        {filtered && filtered.dropped > 0 && (
          <p className="mt-3 rounded-md border border-border bg-surface-sunken p-3 text-sm leading-relaxed">
            <span className="stat-label">Periods left out</span>
            <br />
            {filtered.dropped} full-year period
            {filtered.dropped === 1 ? " was" : "s were"} found in this quarterly
            filing but not kept. Q4 filings print the full-year audited figures
            too, and those are taken from the annual report instead so the two
            can&apos;t disagree.
          </p>
        )}

        {pageInfo && (
          <p className="mt-3 rounded-md border border-border bg-surface-sunken p-3 text-sm leading-relaxed">
            <span className="stat-label">Pages read</span>
            <br />
            {pageInfo.reason}
            {pageInfo.trimmed && pageInfo.selectedPages.length > 0 && (
              <span className="figure block text-xs text-muted">
                Pages {formatPageList(pageInfo.selectedPages)}
              </span>
            )}
          </p>
        )}

        {draft.notes && (
          <p className="mt-3 rounded-md border border-border bg-surface-sunken p-3 text-sm leading-relaxed">
            <span className="stat-label">Claude&apos;s notes</span>
            <br />
            {draft.notes}
          </p>
        )}

        {draft.periods.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
            No periods were found in this document.
          </p>
        ) : (
          <div className="scroll-x mt-6 rounded-lg border border-border">
            <table className="w-full border-collapse bg-surface">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-left">
                  <th className="stat-label px-4 py-3">Line item</th>
                  {draft.periods.map((period, index) => (
                    <th key={index} className="stat-label px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {period.period_label}
                        <button
                          type="button"
                          onClick={() => removePeriod(index)}
                          className="text-negative"
                          title="Remove this period"
                        >
                          ×
                        </button>
                      </div>

                      <select
                        value={period.basis}
                        onChange={(event) => updateBasis(index, event.target.value)}
                        className="mt-1 w-full rounded border border-border bg-surface px-1 py-0.5 text-xs font-normal normal-case tracking-normal outline-none focus:border-accent"
                      >
                        <option value="consolidated">Consolidated</option>
                        <option value="standalone">Standalone</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {SECTIONS.map((section) => (
                  <React.Fragment key={section.key}>
                    <tr className="bg-surface-sunken">
                      <td
                        colSpan={draft.periods.length + 1}
                        className="stat-label px-4 py-2"
                      >
                        {section.title}
                      </td>
                    </tr>

                    {section.items.map((item) => (
                      <tr
                        key={`${section.key}-${item.key}`}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-2 text-sm">{item.label}</td>
                        {draft.periods.map((period, index) => (
                          <td key={index} className="px-4 py-2 text-right">
                            <input
                              type="number"
                              step="any"
                              value={
                                (period[section.key] as Record<string, number | null>)?.[
                                  item.key
                                ] ?? ""
                              }
                              placeholder="—"
                              onChange={(event) =>
                                updateFigure(
                                  index,
                                  section.key,
                                  item.key,
                                  event.target.value,
                                )
                              }
                              className={`${inputClass} figure`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}

                <tr className="bg-surface-sunken">
                  <td
                    colSpan={draft.periods.length + 1}
                    className="stat-label px-4 py-2"
                  >
                    Shares
                  </td>
                </tr>

                <tr className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-sm">
                    Equity shares outstanding
                    <span className="mt-0.5 block text-xs text-muted">
                      A count of shares, not in {draft.currency_unit || "the unit above"}
                    </span>
                  </td>
                  {draft.periods.map((period, index) => (
                    <td key={index} className="px-4 py-2 text-right">
                      <input
                        type="number"
                        step="any"
                        value={period.shares_outstanding ?? ""}
                        placeholder="—"
                        onChange={(event) =>
                          updateShares(index, event.target.value)
                        }
                        className={`${inputClass} figure`}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {draft.periods.some((period) => period.segments.length > 0) && (
          <div className="mt-6">
            <h3 className="text-sm font-medium">Segments found</h3>
            <p className="mt-0.5 text-xs text-muted">
              Saved as read. If a segment looks wrong, re-extract rather than
              editing — the names have to match across years to chart properly.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {draft.periods
                .filter((period) => period.segments.length > 0)
                .map((period, index) => (
                  <div
                    key={index}
                    className="rounded-md border border-border bg-surface p-3"
                  >
                    <p className="stat-label">
                      {period.period_label} · {period.basis}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {period.segments.map((segment, position) => (
                        <li
                          key={`${segment.name}-${position}`}
                          className="flex items-baseline justify-between gap-3 text-sm"
                        >
                          <span>
                            {segment.name}
                            <span className="ml-1.5 text-xs text-muted">
                              {segment.kind}
                            </span>
                          </span>
                          <span className="figure text-muted">
                            {segment.revenue === null
                              ? "—"
                              : new Intl.NumberFormat("en-IN", {
                                  maximumFractionDigits: 2,
                                }).format(segment.revenue)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-negative">{error}</p>}

        <div className="mt-6 flex gap-3 pb-6">
          <button
            type="button"
            onClick={confirm}
            disabled={pending || draft.periods.length === 0}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Confirm and save"}
          </button>
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
