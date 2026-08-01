"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generatePeers } from "@/app/(app)/analyzer/peers";
import type { ComparisonRow } from "@/lib/comparison";
import type { Peers } from "@/lib/peers-schema";

const COLUMNS = [
  { key: "market_cap", label: "Market cap" },
  { key: "pe", label: "P / E" },
  { key: "revenue_growth", label: "Revenue growth" },
  { key: "operating_margin", label: "Operating margin" },
  { key: "roe", label: "Return on equity" },
  { key: "debt_to_equity", label: "Debt / equity" },
] as const;

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** A blank cell means the figure wasn't disclosed, not that it is zero. */
const cell = (value: string) => (value.trim() === "" ? "—" : value);

export function PeerComparison({
  stockId,
  symbol,
  peers,
  self,
  generatedAt,
}: {
  stockId: string;
  symbol: string;
  peers: Peers | null;
  /** The subject company's own column, from confirmed figures. */
  self: ComparisonRow | null;
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

  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-base font-medium">Against its peers</h2>
          <p className="mt-0.5 text-xs text-muted">
            {generatedAt
              ? `Peer figures from the web · ${formatWhen(generatedAt)}`
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

      {!peers ? (
        <p className="mt-4 text-sm text-muted">
          Finds three to five listed Indian competitors and puts their headline
          figures beside yours. {symbol}&apos;s own column comes from the figures
          you confirmed, never from the web.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed">{peers.basis}</p>

          {peers.peers.length > 1 && (
            <p className="mt-3 text-xs text-muted md:hidden">
              Swipe the table sideways to see every column.
            </p>
          )}

          <div className="scroll-x mt-3 rounded-lg border border-border">
            <table className="w-full min-w-3xl border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-left">
                  <th className="stat-label px-4 py-3">Company</th>
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      className="stat-label px-4 py-3 text-right"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {self && (
                  // The subject company sits at the top and is marked as the
                  // only row whose figures the user has actually checked.
                  <tr className="border-b border-border bg-accent-tint">
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{symbol}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {self.period} · your confirmed figures
                      </span>
                    </td>
                    {COLUMNS.map((column) => (
                      <td
                        key={column.key}
                        className="figure px-4 py-3 text-right text-sm"
                      >
                        {cell(self[column.key])}
                      </td>
                    ))}
                  </tr>
                )}

                {peers.peers.map((peer) => (
                  <tr
                    key={`${peer.name}-${peer.symbol}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{peer.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {[peer.symbol, peer.period].filter(Boolean).join(" · ")}
                        {peer.source_url && (
                          <>
                            {" · "}
                            <a
                              href={peer.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent underline underline-offset-2"
                            >
                              {peer.source_label || "source"}
                            </a>
                          </>
                        )}
                      </span>
                    </td>
                    {COLUMNS.map((column) => (
                      <td
                        key={column.key}
                        className="figure px-4 py-3 text-right text-sm"
                      >
                        {cell(peer[column.key])}
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
            Only the {symbol} row comes from figures you checked. The rest were
            read off the web and may cover different periods — follow a source
            link before relying on one.
          </p>
        </>
      )}
    </section>
  );
}
