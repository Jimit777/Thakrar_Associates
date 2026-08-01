"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateKeyPoints } from "@/app/(app)/analyzer/key-points";
import type { KeyPoints } from "@/lib/key-points-schema";

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/**
 * A fact sheet in the shape Screener uses: a labelled point, the fact under it,
 * and a citation you can follow.
 *
 * Deliberately plain. Nothing here is scored, coloured or ranked — the whole
 * value is that it reads in under a minute and every line can be checked.
 */
export function KeyPointsPanel({
  stockId,
  symbol,
  keyPoints,
  generatedAt,
  hasPresentation,
}: {
  stockId: string;
  symbol: string;
  keyPoints: KeyPoints | null;
  generatedAt: string | null;
  /** Whether a deck has been uploaded — it changes where the facts come from. */
  hasPresentation: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await generateKeyPoints(stockId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-base font-medium">About {symbol}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {generatedAt
              ? `Key points · ${formatWhen(generatedAt)}`
              : "What the company is, and what it has disclosed about itself."}
          </p>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {pending ? "Reading…" : keyPoints ? "Refresh" : "Get key points"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      {!hasPresentation && (
        <p className="mt-3 rounded-md border border-border bg-surface-sunken p-3 text-sm text-muted">
          Upload {symbol}&apos;s latest investor presentation under Documents and
          this reads the deck instead of searching the web. It&apos;s the
          company&apos;s own account of itself — sharper facts, and cheaper,
          since it stops searching altogether.
        </p>
      )}

      {!keyPoints ? (
        <p className="mt-4 text-sm text-muted">
          A short fact sheet — business model, scale, customers, guidance — with
          a source on every point. Takes a few seconds and costs a few rupees,
          so refresh it whenever you like.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed">{keyPoints.about}</p>

          <dl className="mt-4 space-y-3.5 border-t border-border pt-4">
            {keyPoints.points.map((point) => (
              <div key={point.label}>
                <dt className="text-sm font-medium">{point.label}</dt>

                <dd className="mt-0.5 text-sm leading-relaxed text-secondary">
                  {point.detail}
                </dd>

                {point.figures.length > 0 && (
                  <dd className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {point.figures.map((figure) => (
                      <span
                        key={figure}
                        className="figure text-xs text-muted"
                      >
                        {figure}
                      </span>
                    ))}
                  </dd>
                )}

                <dd className="mt-1 text-xs text-muted">
                  {point.source_url ? (
                    <a
                      href={point.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline underline-offset-2"
                    >
                      {point.source_label}
                    </a>
                  ) : (
                    point.source_label
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-xs text-muted">
            Facts as the company disclosed them, not an assessment. Anything
            labelled guidance is a target management has stated, not a result.
          </p>
        </>
      )}
    </section>
  );
}
