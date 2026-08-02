import {
  fetchPerformance,
  fetchSymbolPerformance,
  PERFORMANCE_WINDOWS,
  type Performance,
} from "@/lib/prices";
import { PeerRefreshButton } from "@/components/peer-refresh-button";
import { Skeleton } from "@/components/skeleton";
import type { Peers } from "@/lib/peers-schema";

const rupees = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

function signed(value: number | null) {
  if (value === null) return <span className="text-muted">—</span>;
  return (
    <span className={value >= 0 ? "text-positive" : "text-negative"}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

/**
 * Peers compared on market performance rather than on fundamentals.
 *
 * Fundamentals meant reading a web page per company: slow, expensive, and the
 * table still came back with holes because half of what an industry is judged
 * on isn't on the page you land on. Every column here is computed from the
 * price feed instead — one request per company, exact, and free. The model is
 * only asked which companies belong in the table.
 *
 * What this deliberately doesn't claim to be: a valuation comparison. It shows
 * how the market has treated these companies, not which is the better business.
 */
export async function PeerComparison({
  stockId,
  symbol,
  peers,
}: {
  stockId: string;
  symbol: string;
  peers: Peers | null;
}) {
  const named = (peers?.peers ?? []).filter((peer) => peer.symbol.trim() !== "");

  // Every company at once — this is the whole latency budget of the panel.
  const [own, ...fetched] = await Promise.all([
    fetchSymbolPerformance(symbol),
    ...named.map((peer) => fetchPerformance(`${peer.symbol.trim()}.NS`)),
  ]);

  const rows: { label: string; note: string; isSubject: boolean; data: Performance }[] =
    [];

  if (own) {
    rows.push({ label: symbol, note: "this company", isSubject: true, data: own });
  }

  named.forEach((peer, index) => {
    const data = fetched[index];
    if (data) rows.push({ label: peer.name, note: peer.why, isSubject: false, data });
  });

  const unresolved = named.length - fetched.filter(Boolean).length;

  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-base font-medium">Against its peers</h2>
          <p className="mt-0.5 text-xs text-muted">
            How the market has treated them — prices, not fundamentals
          </p>
        </div>

        <PeerRefreshButton stockId={stockId} hasPeers={peers !== null} />
      </div>

      {!peers ? (
        <p className="mt-4 text-sm text-muted">
          Names the companies {symbol} genuinely competes with, then compares
          them on price performance. The comparison itself is drawn from the
          price feed, so it costs nothing and updates every time you open this
          page.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed">{peers.basis}</p>

          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              None of the tickers resolved against the price feed. Press Change
              peers to try again.
            </p>
          ) : (
            <>
              <p className="mt-3 text-xs text-muted md:hidden">
                Swipe the table sideways to see every column.
              </p>

              <div className="scroll-x mt-3 rounded-lg border border-border">
                <table className="w-full min-w-3xl border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-sunken text-left">
                      <th className="stat-label px-4 py-3">Company</th>
                      <th className="stat-label px-4 py-3 text-right">Price</th>
                      {PERFORMANCE_WINDOWS.map(([label]) => (
                        <th key={label} className="stat-label px-4 py-3 text-right">
                          {label}
                        </th>
                      ))}
                      <th className="stat-label px-4 py-3 text-right">
                        52-week range
                        <span className="mt-0.5 block font-normal normal-case tracking-normal text-muted">
                          where it sits
                        </span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.data.ticker}
                        className={`border-b border-border last:border-0 ${
                          row.isSubject ? "bg-accent-tint" : ""
                        }`}
                      >
                        <td className="max-w-xs px-4 py-3 text-sm">
                          <span className="font-medium">{row.label}</span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted">
                            {row.note}
                          </span>
                        </td>

                        <td className="figure px-4 py-3 text-right text-sm">
                          {rupees.format(row.data.price)}
                          {row.data.dayChange !== null && (
                            <span className="mt-0.5 block text-xs">
                              {signed(row.data.dayChange)}
                            </span>
                          )}
                        </td>

                        {PERFORMANCE_WINDOWS.map(([label]) => (
                          <td
                            key={label}
                            className="figure px-4 py-3 text-right text-sm"
                          >
                            {signed(row.data.returns[label] ?? null)}
                          </td>
                        ))}

                        <td className="px-4 py-3 text-right">
                          {row.data.rangePosition === null ? (
                            <span className="text-sm text-muted">—</span>
                          ) : (
                            <>
                              {/* A bar reads faster than a percentage for
                                  "near its high" versus "near its low". */}
                              <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken">
                                <div
                                  className="h-full rounded-full bg-accent"
                                  style={{ width: `${row.data.rangePosition}%` }}
                                />
                              </div>
                              <span className="figure mt-1 block text-xs text-muted">
                                {rupees.format(row.data.low52 ?? 0)} –{" "}
                                {rupees.format(row.data.high52 ?? 0)}
                              </span>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-muted">
                Prices from Yahoo, delayed. Returns are price only — dividends
                are not counted, so a high-yielding company looks worse here than
                it was. This compares how the market has treated these
                companies, not how the businesses have performed.
                {unresolved > 0 &&
                  ` ${unresolved} suggested peer${unresolved === 1 ? "" : "s"} did not resolve against the price feed and ${unresolved === 1 ? "is" : "are"} left out.`}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Holds the panel's space while the peer prices are in flight. */
export function PeerComparisonSkeleton() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-2 h-3 w-64 max-w-full" />
      <Skeleton className="mt-4 h-40 w-full" />
    </section>
  );
}
