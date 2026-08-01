"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateInsights } from "@/app/(app)/analyzer/insights";
import type { Insights } from "@/lib/insights-schema";

type Finding = Insights["strengths"][number];

const SOURCE_LABELS: Record<Finding["source"], string> = {
  confirmed_figures: "your figures",
  web: "web",
  both: "your figures + web",
};

const CONFIDENCE_LABELS: Record<Finding["confidence"], string> = {
  high: "Strong evidence",
  medium: "Reasonable inference",
  low: "Thin evidence",
};

/**
 * Each point shows its evidence and where it came from, rather than a bare
 * verdict — the reader can check it or disagree with it.
 */
function FindingCard({ finding, tone }: { finding: Finding; tone: "good" | "risk" }) {
  const accent = tone === "good" ? "border-l-positive" : "border-l-negative";

  return (
    <li className={`rounded-md border border-border border-l-2 bg-surface p-3 ${accent}`}>
      <p className="text-sm font-medium leading-snug">{finding.headline}</p>

      <p className="figure mt-1.5 text-xs leading-relaxed text-muted">
        {finding.evidence}
      </p>

      <p className="mt-1.5 text-sm leading-relaxed">{finding.meaning}</p>

      <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-muted">
        <span>Source: {SOURCE_LABELS[finding.source]}</span>
        <span>{CONFIDENCE_LABELS[finding.confidence]}</span>
      </p>
    </li>
  );
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export function StockInsights({
  stockId,
  symbol,
  insights,
  generatedAt,
  periodsUsed,
  currentPeriods,
}: {
  stockId: string;
  symbol: string;
  insights: Insights | null;
  generatedAt: string | null;
  periodsUsed: number;
  currentPeriods: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const stale = insights !== null && periodsUsed !== currentPeriods;

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await generateInsights(stockId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Business briefing</h2>
          <p className="mt-0.5 text-xs text-muted">
            {generatedAt
              ? `Built from ${periodsUsed} confirmed period${periodsUsed === 1 ? "" : "s"} plus web research · ${formatWhen(generatedAt)}`
              : "What this company does, and what the figures say about it."}
          </p>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {pending
            ? "Researching…"
            : insights
              ? "Rebuild"
              : "Build briefing"}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-negative">{error}</p>}

      {stale && (
        <p className="mb-3 rounded-md border border-border bg-surface-sunken p-3 text-sm text-muted">
          You&apos;ve confirmed {currentPeriods} periods since this was built
          from {periodsUsed}. Rebuild to take the newer figures into account.
        </p>
      )}

      {!insights ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center">
          <p className="text-sm">No briefing yet for {symbol}.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Builds a plain-English overview of the business, then strengths and
            concerns where every point shows the figures behind it and where they
            came from.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <p className="text-sm leading-relaxed">{insights.business.summary}</p>

            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="stat-label">Industry</dt>
                <dd className="mt-0.5 text-sm">{insights.business.industry}</dd>
              </div>
              <div>
                <dt className="stat-label">How it earns</dt>
                <dd className="mt-0.5 text-sm">{insights.business.revenue_model}</dd>
              </div>
              <div>
                <dt className="stat-label">Where it operates</dt>
                <dd className="mt-0.5 text-sm">{insights.business.footprint}</dd>
              </div>
              <div>
                <dt className="stat-label">Scale</dt>
                <dd className="mt-0.5 text-sm">{insights.business.scale}</dd>
              </div>
            </dl>

            {insights.business.products.length > 0 && (
              <div className="mt-4">
                <p className="stat-label">Products and segments</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {insights.business.products.map((product) => (
                    <li
                      key={product}
                      className="rounded-full border border-border bg-surface-sunken px-2.5 py-1 text-xs"
                    >
                      {product}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="stat-label mb-2">
                Strengths ({insights.strengths.length})
              </h3>
              <ul className="space-y-2">
                {insights.strengths.map((finding) => (
                  <FindingCard key={finding.headline} finding={finding} tone="good" />
                ))}
              </ul>
            </div>

            <div>
              <h3 className="stat-label mb-2">
                Concerns ({insights.concerns.length})
              </h3>
              <ul className="space-y-2">
                {insights.concerns.map((finding) => (
                  <FindingCard key={finding.headline} finding={finding} tone="risk" />
                ))}
              </ul>
            </div>
          </div>

          {insights.watch.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <h3 className="stat-label">What to watch next</h3>
              <ul className="mt-2 space-y-2.5">
                {insights.watch.map((item) => (
                  <li key={item.question}>
                    <p className="text-sm font-medium">{item.question}</p>
                    <p className="mt-0.5 text-sm text-muted">{item.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.data_gaps && (
            <p className="rounded-md border border-border bg-surface-sunken p-3 text-sm text-muted">
              <span className="stat-label">Limits of this briefing</span>
              <br />
              {insights.data_gaps}
            </p>
          )}

          {insights.sources?.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <h3 className="stat-label">Sources</h3>
              <ul className="mt-2 space-y-1.5">
                {insights.sources.map((source) => (
                  <li key={source.url} className="text-sm">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline break-all"
                    >
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted">
            Generated from your confirmed figures and web sources. Check anything
            you plan to act on — it is not investment advice.
          </p>
        </div>
      )}
    </section>
  );
}
