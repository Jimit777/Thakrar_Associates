"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { summariseConcall } from "@/app/(app)/analyzer/concall";
import type { ConcallSummary } from "@/lib/concall-schema";

export type ConcallEntry = {
  documentId: string;
  periodLabel: string;
  fileName: string;
  summary: ConcallSummary | null;
  generatedAt: string | null;
};

const SENTIMENT_TONE: Record<ConcallSummary["sentiment"], string> = {
  confident: "text-positive",
  measured: "text-muted",
  cautious: "text-muted",
  defensive: "text-negative",
  mixed: "text-muted",
};

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function SummaryBody({ summary }: { summary: ConcallSummary }) {
  return (
    <div className="mt-3 space-y-4">
      <p className="text-sm leading-relaxed">{summary.headline}</p>

      <p className="text-sm">
        <span className="stat-label">Tone</span>{" "}
        <span className={`font-medium capitalize ${SENTIMENT_TONE[summary.sentiment]}`}>
          {summary.sentiment}
        </span>
        <span className="text-muted"> — {summary.sentiment_basis}</span>
      </p>

      {summary.key_points.length > 0 && (
        <div>
          <p className="stat-label">What management said</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
            {summary.key_points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.guidance.length > 0 && (
        <div>
          <p className="stat-label">Guidance given</p>
          <ul className="mt-1.5 space-y-1.5">
            {summary.guidance.map((item) => (
              <li key={item.topic} className="text-sm">
                <span className="font-medium">{item.topic}:</span> {item.said}{" "}
                <span
                  className={`ml-1 rounded-full border px-1.5 py-0.5 text-[10px] ${
                    item.quantified
                      ? "border-positive/40 text-positive"
                      : "border-border text-muted"
                  }`}
                >
                  {item.quantified ? "with numbers" : "no numbers"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.analyst_focus.length > 0 && (
        <div>
          <p className="stat-label">What analysts pressed on</p>
          <ul className="mt-1.5 space-y-2">
            {summary.analyst_focus.map((item) => (
              <li key={item.question} className="text-sm">
                <p className="font-medium">{item.question}</p>
                <p className="text-muted">{item.response}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.quotes.length > 0 && (
        <div>
          <p className="stat-label">In their words</p>
          <ul className="mt-1.5 space-y-2">
            {summary.quotes.map((item) => (
              <li
                key={item.quote}
                className="border-l-2 border-border pl-3 text-sm italic leading-relaxed"
              >
                &ldquo;{item.quote}&rdquo;
                <span className="mt-0.5 block not-italic text-xs text-muted">
                  — {item.speaker}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.risks_flagged.length > 0 && (
        <div>
          <p className="stat-label">Risks management raised</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
            {summary.risks_flagged.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.not_addressed && (
        <p className="rounded-md border border-border bg-surface-sunken p-3 text-sm">
          <span className="stat-label">Left unanswered</span>
          <br />
          {summary.not_addressed}
        </p>
      )}
    </div>
  );
}

export function ConcallSummaries({ entries }: { entries: ConcallEntry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(
    entries.find((entry) => entry.summary)?.documentId ?? null,
  );

  if (entries.length === 0) return null;

  function run(documentId: string) {
    setError(null);
    setBusyId(documentId);
    startTransition(async () => {
      const result = await summariseConcall(documentId);
      if (!result.ok) setError(result.error);
      else {
        setOpenId(documentId);
        router.refresh();
      }
      setBusyId(null);
    });
  }

  return (
    <section className="mt-8">
      <div className="mb-3">
        <h2 className="text-base font-medium">Earnings calls</h2>
        <p className="mt-0.5 text-xs text-muted">
          What management committed to, what analysts pushed on, and what went
          unanswered.
        </p>
      </div>

      {error && <p className="mb-3 text-sm text-negative">{error}</p>}

      <div className="space-y-3">
        {entries.map((entry) => {
          const open = openId === entry.documentId;
          const working = pending && busyId === entry.documentId;

          return (
            <div
              key={entry.documentId}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{entry.periodLabel}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {entry.fileName}
                    {entry.generatedAt
                      ? ` · summarised ${formatWhen(entry.generatedAt)}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {entry.summary && (
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : entry.documentId)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:border-accent hover:text-accent"
                    >
                      {open ? "Hide" : "Show"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => run(entry.documentId)}
                    disabled={pending}
                    className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    {working
                      ? "Reading…"
                      : entry.summary
                        ? "Redo"
                        : "Summarise"}
                  </button>
                </div>
              </div>

              {entry.summary && open && <SummaryBody summary={entry.summary} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
