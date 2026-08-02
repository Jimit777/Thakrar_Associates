"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generatePeers } from "@/app/(app)/analyzer/peers";
import type { ComputedFigures } from "@/lib/comparison";
import type { Peers } from "@/lib/peers-schema";

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** A blank means the figure wasn't disclosed, not that it is zero. */
const show = (value: string | undefined) =>
  !value || value.trim() === "" ? "—" : value;

export function PeerComparison({
  stockId,
  symbol,
  peers,
  own,
  generatedAt,
}: {
  stockId: string;
  symbol: string;
  peers: Peers | null;
  /** Figures the app worked out from confirmed filings, which override the web. */
  own: ComputedFigures | null;
  generatedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await generatePeers(stockId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  // Columns come from the model, chosen for the industry rather than fixed.
  const metrics = peers?.metrics ?? [];

  const rows = (peers?.companies ?? []).map((company) => {
    const found = new Map(
      company.values.map((entry) => [entry.metric, entry.value]),
    );

    // For the subject company a verified figure beats a published one, so
    // anything the app can compute replaces what was found on the web.
    const cells = metrics.map((metric) => {
      const computed = company.is_subject
        ? own?.values.get(metric.label)
        : undefined;

      return {
        label: metric.label,
        value: computed ?? found.get(metric.label) ?? "",
        confirmed: computed !== undefined,
      };
    });

    return { company, cells };
  });

  // The subject first — it is the one every other row is being read against.
  rows.sort((a, b) => Number(b.company.is_subject) - Number(a.company.is_subject));

  const anyConfirmed = rows.some((row) => row.cells.some((cell) => cell.confirmed));

  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-base font-medium">Against its peers</h2>
          <p className="mt-0.5 text-xs text-muted">
            {generatedAt
              ? `Compared on what this industry is judged by · ${formatWhen(generatedAt)}`
              : "How the figures compare with listed competitors."}
          </p>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {pending ? "Researching…" : peers ? "Refresh" : "Find peers"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      {peers && (metrics.length === 0 || rows.length === 0) ? (
        // A comparison saved before the columns became industry-specific. It
        // can't be rendered in the new shape, and re-reading it costs nothing
        // the reader hasn't already paid for.
        <p className="mt-4 text-sm text-muted">
          This comparison was built before the columns were chosen per industry.
          Press Refresh to rebuild it.
        </p>
      ) : !peers ? (
        <p className="mt-4 text-sm text-muted">
          Finds listed Indian competitors and compares them on the measures this
          industry actually uses — a lender on assets and bad loans, a
          manufacturer on margins and capacity. {symbol}&apos;s own figures come
          from what you confirmed wherever the app can work them out.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed">{peers.basis}</p>

          {metrics.length > 3 && (
            <p className="mt-3 text-xs text-muted md:hidden">
              Swipe the table sideways to see every column.
            </p>
          )}

          <div className="scroll-x mt-3 rounded-lg border border-border">
            <table className="w-full min-w-3xl border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-left">
                  <th className="stat-label px-4 py-3">Company</th>
                  {metrics.map((metric) => (
                    <th
                      key={metric.label}
                      className="stat-label px-4 py-3 text-right"
                    >
                      {metric.label}
                      {metric.note && (
                        <span className="mt-0.5 block font-normal normal-case tracking-normal text-muted">
                          {metric.note}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map(({ company, cells }) => (
                  <tr
                    key={`${company.name}-${company.symbol}`}
                    className={`border-b border-border last:border-0 ${
                      company.is_subject ? "bg-accent-tint" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">
                        {company.is_subject ? symbol : company.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {[
                          company.is_subject ? null : company.symbol,
                          own && company.is_subject ? own.period : company.period,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        {company.source_url && !company.is_subject && (
                          <>
                            {" · "}
                            <a
                              href={company.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent underline underline-offset-2"
                            >
                              {company.source_label || "source"}
                            </a>
                          </>
                        )}
                      </span>
                    </td>

                    {cells.map((cell) => (
                      <td
                        key={cell.label}
                        className="figure px-4 py-3 text-right text-sm"
                      >
                        {show(cell.value)}
                        {cell.confirmed && (
                          <span
                            className="ml-0.5 text-accent"
                            title="From figures you confirmed, not from the web"
                          >
                            *
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {peers.caveat && (
            <p className="mt-3 text-xs text-muted">{peers.caveat}</p>
          )}

          <p className="mt-2 text-xs text-muted">
            {anyConfirmed && (
              <>
                * worked out from figures you confirmed. Everything else was read
                off the web and may cover a different period —{" "}
              </>
            )}
            {!anyConfirmed && "Every figure here was read off the web — "}
            follow a source link before relying on one.
          </p>
        </>
      )}
    </section>
  );
}
