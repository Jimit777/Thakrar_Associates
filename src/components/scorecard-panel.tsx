import type { Scorecard, Verdict } from "@/lib/scorecard";

const VERDICT_STYLES: Record<
  Verdict,
  { bar: string; text: string; label: string }
> = {
  strong: { bar: "bg-positive", text: "text-positive", label: "Strong" },
  fair: { bar: "bg-accent", text: "text-accent", label: "Fair" },
  weak: { bar: "bg-negative", text: "text-negative", label: "Weak" },
  unknown: { bar: "bg-border-strong", text: "text-muted", label: "No data" },
};

/**
 * Five checks, each showing the figure it measured and the band it fell in.
 *
 * The workings sit in a `<details>` rather than a tooltip: a threshold you can
 * read is a threshold you can argue with, which is the point of showing them at
 * all. No client JavaScript is involved.
 */
export function ScorecardPanel({ scorecard }: { scorecard: Scorecard }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-base font-medium">Scorecard</h2>
          <p className="mt-0.5 text-xs text-muted">
            Calculated from your confirmed figures. Not a recommendation.
          </p>
        </div>
        <p className="text-sm text-muted">
          <span className="figure text-foreground">{scorecard.strong}</span> of{" "}
          <span className="figure text-foreground">{scorecard.judged}</span>{" "}
          strong
        </p>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {scorecard.checks.map((check) => {
          const style = VERDICT_STYLES[check.verdict];

          return (
            <li
              key={check.key}
              className="rounded-md border border-border bg-surface-sunken p-3"
            >
              <p className="stat-label">{check.label}</p>
              <p className={`figure mt-1 text-lg ${style.text}`}>{check.value}</p>
              {/* The figure alone is ambiguous — 0.82× of what? */}
              <p className="mt-0.5 text-[11px] leading-snug text-muted">
                {check.measure}
              </p>
              <div
                className={`mt-2 h-1 rounded-full ${style.bar}`}
                aria-hidden
              />
              <p className={`mt-1.5 text-[11px] ${style.text}`}>{style.label}</p>
            </li>
          );
        })}
      </ul>

      <details className="mt-4 border-t border-border pt-3">
        <summary className="cursor-pointer text-sm text-muted transition-colors hover:text-foreground">
          How each of these was worked out
        </summary>

        <dl className="mt-3 space-y-3">
          {scorecard.checks.map((check) => (
            <div key={check.key}>
              <dt className="text-sm font-medium">
                {check.label}
                <span
                  className={`ml-2 font-normal ${VERDICT_STYLES[check.verdict].text}`}
                >
                  {check.value}
                </span>
                <span className="ml-2 font-normal text-muted">
                  {check.measure}
                </span>
              </dt>
              <dd className="mt-0.5 text-sm text-muted">{check.basis}</dd>
              <dd className="text-xs text-muted">{check.thresholds}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
