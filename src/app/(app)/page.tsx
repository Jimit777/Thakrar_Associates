import Link from "next/link";
import { PageHeading, EmptyState } from "@/components/page-heading";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatPercent } from "@/lib/format";

type HoldingRow = {
  symbol: string;
  quantity: number;
  avg_price: number;
  last_price: number | null;
  last_refreshed_at: string | null;
};

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : "";

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="stat-label">{label}</p>
      {/* Long totals wrap instead of overflowing a half-width tile. */}
      <p
        className={`figure mt-1.5 text-xl break-words sm:text-2xl ${toneClass}`}
      >
        {value}
      </p>
      {note && <p className={`figure text-xs ${toneClass}`}>{note}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: holdingsData },
    { data: stocksData },
    { data: documentsData },
  ] = await Promise.all([
    supabase
      .from("holdings")
      .select("symbol, quantity, avg_price, last_price, last_refreshed_at"),
    supabase.from("stocks").select("id, symbol"),
    supabase
      .from("documents")
      .select("id, stock_id, period_label, created_at")
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const holdings: HoldingRow[] = (holdingsData ?? []).map((row) => ({
    symbol: row.symbol as string,
    quantity: Number(row.quantity),
    avg_price: Number(row.avg_price),
    last_price: row.last_price === null ? null : Number(row.last_price),
    last_refreshed_at: row.last_refreshed_at as string | null,
  }));

  const invested = holdings.reduce(
    (sum, h) => sum + h.quantity * h.avg_price,
    0,
  );
  const priced = holdings.filter((h) => h.last_price !== null);
  const currentValue = priced.reduce(
    (sum, h) => sum + h.quantity * (h.last_price ?? 0),
    0,
  );
  const pricedInvested = priced.reduce(
    (sum, h) => sum + h.quantity * h.avg_price,
    0,
  );
  const pnl = currentValue - pricedInvested;
  const pnlPercent = pricedInvested === 0 ? 0 : (pnl / pricedInvested) * 100;

  const lastRefreshed = holdings
    .map((h) => h.last_refreshed_at)
    .filter((v): v is string => v !== null)
    .sort()
    .at(-1);

  // Best and worst performers, so the dashboard says something a total can't.
  const movers = priced
    .map((h) => ({
      symbol: h.symbol,
      percent: ((h.last_price! - h.avg_price) / h.avg_price) * 100,
    }))
    .sort((a, b) => b.percent - a.percent);

  const stocks = (stocksData ?? []) as { id: string; symbol: string }[];
  const recentDocuments = (documentsData ?? []) as {
    id: string;
    stock_id: string;
    period_label: string;
    created_at: string;
  }[];
  const symbolByStockId = new Map(stocks.map((s) => [s.id, s.symbol]));

  return (
    <>
      <PageHeading
        title="Dashboard"
        subtitle={
          lastRefreshed
            ? `Prices last refreshed ${formatWhen(lastRefreshed)}`
            : "Your portfolio and research at a glance."
        }
      />

      {holdings.length === 0 ? (
        <EmptyState
          title="Nothing to show yet"
          description="Add the stocks you own and their average buy price. Totals, movers and everything else on this page follow from that."
          action={
            <Link
              href="/portfolio"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Add your first holding
            </Link>
          }
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Invested" value={formatCurrency(invested)} />
            <Tile
              label="Current value"
              value={priced.length > 0 ? formatCurrency(currentValue) : "—"}
            />
            <Tile
              label="Unrealised P&L"
              value={priced.length > 0 ? formatCurrency(pnl) : "—"}
              note={priced.length > 0 ? formatPercent(pnlPercent) : undefined}
              tone={
                priced.length > 0
                  ? pnl >= 0
                    ? "positive"
                    : "negative"
                  : undefined
              }
            />
            <Tile
              label="Holdings"
              value={String(holdings.length)}
              note={
                priced.length < holdings.length
                  ? `${holdings.length - priced.length} unpriced`
                  : undefined
              }
            />
          </section>

          <div className="mt-6">
            <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <h2 className="text-base font-medium">Movers</h2>

              {movers.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  Refresh prices on the portfolio page to see gains and losses.
                </p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {[...movers.slice(0, 3), ...movers.slice(-2)]
                    .filter(
                      (mover, index, list) =>
                        list.findIndex((m) => m.symbol === mover.symbol) ===
                        index,
                    )
                    .map((mover) => (
                      <li
                        key={mover.symbol}
                        className="flex items-center justify-between gap-3 py-1.5 text-sm"
                      >
                        <Link
                          href={`/analyzer/${mover.symbol}`}
                          className="transition-colors hover:text-accent"
                        >
                          {mover.symbol}
                        </Link>
                        <span
                          className={`figure ${
                            mover.percent >= 0
                              ? "text-positive"
                              : "text-negative"
                          }`}
                        >
                          {formatPercent(mover.percent)}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {recentDocuments.length > 0 && (
        <section className="mt-6 rounded-lg border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-base font-medium">Recently uploaded</h2>
          <ul className="mt-3 space-y-1">
            {recentDocuments.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-x-3 py-1.5 text-sm"
              >
                <Link
                  href={`/analyzer/${symbolByStockId.get(doc.stock_id) ?? ""}`}
                  className="transition-colors hover:text-accent"
                >
                  <span className="font-medium">
                    {symbolByStockId.get(doc.stock_id)}
                  </span>
                  <span className="ml-2 text-muted">{doc.period_label}</span>
                </Link>
                <span className="figure text-xs text-muted">
                  {formatWhen(doc.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
