"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generatePromises } from "@/app/(app)/analyzer/promises";
import type { Promises } from "@/lib/promises-schema";

type Outcome = Promises["promises"][number]["outcome"];

const OUTCOME_STYLES: Record<Outcome, { label: string; className: string }> = {
  met: { label: "Delivered", className: "border-positive/40 text-positive" },
  missed: { label: "Missed", className: "border-negative/40 text-negative" },
  partly: { label: "Partly", className: "border-accent/40 text-accent" },
  too_early: { label: "Too early", className: "border-border text-muted" },
  unclear: { label: "Can't tell", className: "border-border text-muted" },
};

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/**
 * Guidance given on past calls, against what the figures went on to show.
 *
 * A company that hits what it guides to is telling you something no ratio does,
 * and so is one that doesn't. The app already stores the guidance; this is the
 * step of going back later to check.
 */
export function PromiseTracker({
  stockId,
  promises,
  generatedAt,
  callsUsed,
  currentCalls,
}: {
  stockId: string;
  promises: Promises | null;
  generatedAt: string | null;
  callsUsed: number;
  /** Summarised calls available now, to spot a tracker built from fewer. */
  currentCalls: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const stale = promises !== null && callsUsed !== currentCalls;

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await generatePromises(stockId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-base font-medium">Said and done</h2>
          <p className="mt-0.5 text-xs text-muted">
            {generatedAt
              ? `From ${callsUsed} call${callsUsed === 1 ? "" : "s"} · ${formatWhen(generatedAt)}`
              : "What management guided to, against what the figures showed."}
          </p>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={pending || currentCalls === 0}
          title={
            currentCalls === 0
              ? "Summarise an earnings call first — the guidance comes from there"
              : undefined
          }
          className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {pending ? "Checking…" : promises ? "Rebuild" : "Check the record"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      {stale && (
        <p className="mt-3 rounded-md border border-border bg-surface-sunken p-3 text-sm text-muted">
          You&apos;ve summarised {currentCalls} calls since this was built from{" "}
          {callsUsed}. Rebuild to include the newer ones.
        </p>
      )}

      {!promises ? (
        <p className="mt-4 text-sm text-muted">
          {currentCalls === 0
            ? "Nothing to check yet. Summarise an earnings call under the Earnings calls tab — guidance is taken from there, then set against your confirmed figures."
            : "Takes the guidance out of your summarised calls and checks each piece against the periods that would settle it. No web search, so it can only claim what your own figures show."}
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed">{promises.record}</p>

          {promises.promises.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              No checkable guidance in those calls — management spoke only in
              generalities, which is itself worth knowing.
            </p>
          ) : (
            <ul className="mt-4 space-y-3 border-t border-border pt-4">
              {promises.promises.map((promise, index) => {
                const style = OUTCOME_STYLES[promise.outcome];

                return (
                  <li key={`${promise.said_in}-${promise.topic}-${index}`}>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-sm font-medium">{promise.topic}</span>
                      <span className="text-xs text-muted">
                        said on {promise.said_in}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${style.className}`}
                      >
                        {style.label}
                      </span>
                    </div>

                    <p className="mt-1 border-l-2 border-border pl-3 text-sm leading-relaxed italic">
                      &ldquo;{promise.promised}&rdquo;
                    </p>

                    <p className="figure mt-1.5 text-xs leading-relaxed text-muted">
                      {promise.evidence}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 text-xs text-muted">
            Judged only against periods you have confirmed. A verdict of
            can&apos;t tell usually means the line it turns on was never
            extracted.
          </p>
        </>
      )}
    </section>
  );
}
