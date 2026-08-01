"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateNewsDigest, searchNews } from "@/app/(app)/news/actions";
import type {
  NewsDigest,
  NewsItem,
  NewsSearchResults,
} from "@/lib/news-schema";

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function ScopeTag({ scope }: { scope: NewsItem["scope"] }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        scope === "global"
          ? "bg-surface-sunken text-muted"
          : "bg-accent/10 text-accent"
      }`}
    >
      {scope === "global" ? "World" : "India"}
    </span>
  );
}

/**
 * One story. The headline carries the news, the detail sits quieter beneath it,
 * and "why it matters" is set apart — three levels of weight rather than three
 * paragraphs of the same grey text.
 */
function Story({ item }: { item: NewsItem }) {
  return (
    <li className="border-t border-border py-4 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-2">
        <ScopeTag scope={item.scope} />
        <h4 className="text-[15px] font-medium leading-snug">{item.headline}</h4>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        {item.what_happened}
      </p>

      <p className="mt-2 border-l-2 border-accent/30 pl-3 text-sm leading-relaxed">
        {item.why_it_matters}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2"
        >
          {item.source_label}
        </a>
        {item.when && <span>{item.when}</span>}
        {item.affected.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {item.affected.map((symbol) => (
              <span
                key={symbol}
                className="rounded bg-surface-sunken px-1.5 py-0.5 font-medium"
              >
                {symbol}
              </span>
            ))}
          </span>
        )}
      </div>
    </li>
  );
}

function SearchPanel() {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<NewsSearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim() || pending) return;

    setError(null);
    startTransition(async () => {
      const result = await searchNews(query);
      if (result.ok) setResults(result.results);
      else {
        setError(result.error);
        setResults(null);
      }
    });
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-base font-medium">Look something up</h2>
      <p className="mt-0.5 text-xs text-muted">
        Any stock or sector — you don&apos;t have to hold it.
      </p>

      <form onSubmit={run} className="mt-3 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="RELIANCE, or Indian pharma exports"
          className="min-w-56 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending || !query.trim()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Looking…" : "Search"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      {results && (
        <div className="mt-5">
          {results.summary && (
            <p className="rounded-md bg-surface-sunken p-3 text-sm leading-relaxed">
              {results.summary}
            </p>
          )}

          {results.results.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing found for that.</p>
          ) : (
            <ul className="mt-4">
              {results.results.map((item) => (
                <li
                  key={item.url}
                  className="border-t border-border py-3.5 first:border-t-0 first:pt-0"
                >
                  <h4 className="text-[15px] font-medium leading-snug">
                    {item.headline}
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {item.detail}
                  </p>
                  <p className="mt-1.5 border-l-2 border-accent/30 pl-3 text-sm leading-relaxed">
                    {item.matters}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline underline-offset-2"
                    >
                      {item.source_label}
                    </a>
                    {item.when && <span>{item.when}</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {results.note && (
            <p className="mt-3 text-xs text-muted">{results.note}</p>
          )}
        </div>
      )}
    </section>
  );
}

export function NewsDigestView({
  digest,
  generatedAt,
  coveredSymbols,
  currentSymbols,
}: {
  digest: NewsDigest | null;
  generatedAt: string | null;
  coveredSymbols: string[];
  currentSymbols: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const missing = currentSymbols.filter((s) => !coveredSymbols.includes(s));

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await generateNewsDigest();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <SearchPanel />

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Your portfolio</h2>
            <p className="mt-0.5 text-xs text-muted">
              {generatedAt
                ? `${coveredSymbols.length} holding${coveredSymbols.length === 1 ? "" : "s"} · updated ${formatWhen(generatedAt)}`
                : "Grouped by sector, Indian and international."}
            </p>
          </div>

          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {pending
              ? "Reading the news…"
              : digest
                ? "Update"
                : "Build"}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-negative">{error}</p>}

        {digest && missing.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Not yet covered: {missing.join(", ")} — update to include them.
          </p>
        )}

        {!digest ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="text-sm">Nothing built yet.</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Groups your holdings by sector and tells you what moved in each.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {digest.takeaway && (
              <p className="rounded-lg border border-accent/30 bg-surface p-4 text-[15px] leading-relaxed">
                {digest.takeaway}
              </p>
            )}

            {digest.macro.length > 0 && (
              <div className="rounded-lg border border-border bg-surface p-5">
                <h3 className="text-sm font-medium">Across the market</h3>
                <ul className="mt-3">
                  {digest.macro.map((item) => (
                    <Story key={item.url + item.headline} item={item} />
                  ))}
                </ul>
              </div>
            )}

            {digest.sectors.map((sector) => (
              <div
                key={sector.sector}
                className="rounded-lg border border-border bg-surface p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-sm font-medium">{sector.sector}</h3>
                  <p className="flex flex-wrap gap-1">
                    {sector.holdings.map((symbol) => (
                      <span
                        key={symbol}
                        className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-muted"
                      >
                        {symbol}
                      </span>
                    ))}
                  </p>
                </div>

                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {sector.sector_read}
                </p>

                {sector.items.length > 0 && (
                  <ul className="mt-4 border-t border-border pt-4">
                    {sector.items.map((item) => (
                      <Story key={item.url + item.headline} item={item} />
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {digest.coverage_note && (
              <p className="text-xs text-muted">{digest.coverage_note}</p>
            )}

            <p className="text-xs text-muted">
              From public news sources. Check anything you plan to act on — this
              is not investment advice.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
