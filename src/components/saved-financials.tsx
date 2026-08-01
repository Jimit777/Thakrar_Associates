"use client";

import React, { useState } from "react";
import { deleteFinancialRow } from "@/app/(app)/analyzer/extract";
import { SECTIONS } from "@/lib/extraction-schema";
import { computeRatios, operatingProfit, RATIOS } from "@/lib/ratios";
import { FinancialCharts } from "@/components/financial-charts";
import type { FinancialRow } from "@/types/financial";

function formatFigure(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

function formatRatio(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(unit === "%" ? 1 : 2)}${unit === "%" ? "%" : "×"}`;
}

const toggleBase =
  "rounded-md border px-3 py-1 text-xs font-medium transition-colors";

export function SavedFinancials({ rows }: { rows: FinancialRow[] }) {
  const annual = rows.filter((row) => row.period_type === "annual");
  const quarterly = rows.filter((row) => row.period_type === "quarterly");

  const [view, setView] = useState<"annual" | "quarterly">(
    annual.length > 0 ? "annual" : "quarterly",
  );
  const [basis, setBasis] = useState<FinancialRow["basis"]>("consolidated");

  if (rows.length === 0) return null;

  const forView = view === "annual" ? annual : quarterly;

  // Consolidated and standalone are different sets of figures, so only one is
  // shown at a time rather than mixed into the same table.
  const bases = ["consolidated", "standalone", "unknown"].filter((candidate) =>
    forView.some((row) => row.basis === candidate),
  ) as FinancialRow["basis"][];

  const activeBasis = bases.includes(basis) ? basis : (bases[0] ?? "unknown");
  const visible = forView.filter((row) => row.basis === activeBasis);
  const ratiosByRow = visible.map((row) => computeRatios(row.data));

  // A unit mismatch within one basis is still worth flagging — a figure in
  // lakh sitting beside one in crore looks like a hundredfold change.
  const units = [
    ...new Set(visible.map((row) => row.currency_unit).filter(Boolean)),
  ] as string[];
  const mixedUnits = units.length > 1;
  const unit = units.length === 1 ? units[0] : null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-base font-medium">Financials</h2>

          <div className="flex gap-1.5">
            {(
              [
                ["annual", "Annual", annual.length],
                ["quarterly", "Quarterly", quarterly.length],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                disabled={count === 0}
                title={count === 0 ? `No ${label.toLowerCase()} periods saved yet` : undefined}
                className={`${toggleBase} ${
                  view === value
                    ? "border-accent bg-accent text-background"
                    : "border-border hover:border-accent hover:text-accent"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          {bases.length > 1 && (
            <div className="flex gap-1.5">
              {bases.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setBasis(candidate)}
                  className={`${toggleBase} capitalize ${
                    activeBasis === candidate
                      ? "border-accent bg-accent text-background"
                      : "border-border hover:border-accent hover:text-accent"
                  }`}
                >
                  {candidate}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-sm text-muted">
          {unit ? `Figures in ${unit}` : "Units shown per period"}
        </p>
      </div>

      {mixedUnits && visible.length > 1 && (
        <div className="mb-3 rounded-md border border-negative/40 bg-surface-sunken p-3 text-sm">
          <p className="font-medium text-negative">
            These columns aren&apos;t directly comparable
          </p>
          <p className="mt-1 text-muted">
            Different units: {units.join(" and ")}. A figure in lakh is 100×
            smaller than the same figure in crore — re-extract the odd one out
            and correct its unit before comparing.
          </p>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
          No {view} periods saved yet.
        </p>
      ) : (
        <>
          {/* Several periods will not fit across a phone, so say so rather than
              leaving the extra columns to be discovered by accident. */}
          {visible.length > 1 && (
            <p className="mb-2 text-xs text-muted md:hidden">
              Swipe the table sideways to see all {visible.length} periods.
            </p>
          )}

          <div className="scroll-x rounded-lg border border-border">
            <table className="w-full border-collapse bg-surface">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-left">
                  <th className="stat-label px-4 py-3">Line item</th>
                  {visible.map((row) => (
                    <th key={row.id} className="stat-label px-4 py-3 text-right">
                      {row.period_label}
                      {mixedUnits && row.currency_unit && (
                        <span className="block font-normal normal-case tracking-normal text-muted">
                          {row.currency_unit}
                        </span>
                      )}
                      {row.source_document_id && (
                        // Opens the report these figures were read from, at the
                        // page they were read from.
                        <a
                          href={`/api/source/${row.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block font-normal normal-case tracking-normal text-accent underline underline-offset-2"
                          title="Open the source report at the page these figures came from"
                        >
                          source
                        </a>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {SECTIONS.map((section) => {
                  const hasAnyValue = visible.some((row) =>
                    section.items.some(
                      (item) => row.data[section.key]?.[item.key] != null,
                    ),
                  );

                  return (
                    <React.Fragment key={section.key}>
                      <tr className="bg-surface-sunken">
                        <td
                          colSpan={visible.length + 1}
                          className="stat-label px-4 py-2"
                        >
                          {section.title}
                          {!hasAnyValue && (
                            <span className="ml-2 font-normal normal-case tracking-normal text-muted">
                              — not reported in these documents
                            </span>
                          )}
                        </td>
                      </tr>

                      {hasAnyValue &&
                        section.items.map((item) => {
                          const isOperatingProfit =
                            section.key === "income_statement" &&
                            item.key === "operating_profit";

                          return (
                            <tr
                              key={`${section.key}-${item.key}`}
                              className="border-b border-border last:border-0"
                            >
                              <td className="px-4 py-2 text-sm">{item.label}</td>
                              {visible.map((row) => {
                                if (isOperatingProfit) {
                                  const { value, derived } = operatingProfit(
                                    row.data.income_statement ?? {},
                                  );
                                  return (
                                    <td
                                      key={row.id}
                                      className="figure px-4 py-2 text-right text-sm"
                                    >
                                      {formatFigure(value)}
                                      {derived && value !== null && (
                                        <span
                                          className="ml-1 not-italic text-muted"
                                          title="Calculated by the app — this line was not printed in the report"
                                        >
                                          *
                                        </span>
                                      )}
                                    </td>
                                  );
                                }

                                return (
                                  <td
                                    key={row.id}
                                    className="figure px-4 py-2 text-right text-sm"
                                  >
                                    {formatFigure(row.data[section.key]?.[item.key])}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })}

                <tr className="bg-surface-sunken">
                  <td colSpan={visible.length + 1} className="stat-label px-4 py-2">
                    Ratios · calculated from the figures above
                  </td>
                </tr>

                {RATIOS.map((ratio) => (
                  <tr key={ratio.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-sm">{ratio.label}</td>
                    {visible.map((row, index) => (
                      <td
                        key={row.id}
                        className="figure px-4 py-2 text-right text-sm"
                      >
                        {formatRatio(ratiosByRow[index][ratio.key], ratio.unit)}
                      </td>
                    ))}
                  </tr>
                ))}

                <tr className="bg-surface-sunken">
                  <td className="px-4 py-2 text-xs text-muted">Remove period</td>
                  {visible.map((row) => (
                    <td key={row.id} className="px-4 py-2 text-right">
                      <form action={deleteFinancialRow} className="inline">
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="rounded border border-border px-2 py-0.5 text-xs transition-colors hover:border-negative hover:text-negative"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-muted">
            * Calculated by the app from revenue and expenses, because the report
            did not print this line separately.
          </p>

          <FinancialCharts rows={visible} unit={unit} view={view} />
        </>
      )}
    </section>
  );
}
