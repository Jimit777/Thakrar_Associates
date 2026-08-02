import { Suspense } from "react";
import Link from "next/link";
import { PageHeading, EmptyState } from "@/components/page-heading";
import { SectorAllocation } from "@/components/sector-allocation";
import { DigestEmailToggle } from "@/components/digest-email-toggle";
import {
  PortfolioVsIndex,
  PortfolioVsIndexSkeleton,
} from "@/components/portfolio-vs-index";
import { createClient } from "@/lib/supabase/server";
import {
  concentrationFlags,
  moversByContribution,
  sectorBreakdown,
} from "@/lib/portfolio-analytics";
import { formatCurrency, formatPercent } from "@/lib/format";

type HoldingRow = {
  symbol: string;
  quantity: number;
  avg_price: number;
  last_price: number | null;
  previous_close: number | null;
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
    { data: companiesData },
    { data: settings },
  ] = await Promise.all([
    supabase
      .from("holdings")
      .select("symbol, quantity, avg_price, last_price, previous_close, last_refreshed_at"),
    supabase.from("stocks").select("id, symbol, sector"),
    supabase
      .from("documents")
      .select("id, stock_id, period_label, created_at")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase.from("companies").select("symbol, sector"),
    supabase
      .from("user_settings")
      .select("digest_email_enabled")
      .maybeSingle<{ digest_email_enabled: boolean }>(),
  ]);

  const holdings: HoldingRow[] = (holdingsData ?? []).map((row) => ({
    symbol: row.symbol as string,
    quantity: Number(row.quantity),
    avg_price: Number(row.avg_price),
    last_price: row.last_price === null ? null : Number(row.last_price),
    previous_close:
      row.previous_close === null ? null : Number(row.previous_close),
    last_refreshed_at: row.last_refreshed_at as string | null,
  }));

  // Today's move, which the since-you-bought totals hide entirely.
  const dayBase = holdings.reduce(
    (sum, h) =>
      h.previous_close === null ? sum : sum + h.quantity * h.previous_close,
    0,
  );
  const dayAmount = holdings.reduce(
    (sum, h) =>
      h.previous_close === null || h.last_price === null
        ? sum
        : sum + h.quantity * (h.last_price - h.previous_close),
    0,
  );
  const dayPercent = dayBase === 0 ? null : (dayAmount / dayBase) * 100;

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

  const valued = holdings.map((h) => ({
    symbol: h.symbol,
    quantity: h.quantity,
    avgPrice: h.avg_price,
    lastPrice: h.last_price,
  }));

  // Ranked by money, not by percentage: a 40% gain on a small position moves
  // less than a 2% gain on a large one.
  const movers = moversByContribution(valued);

  const stocks = (stocksData ?? []) as {
    id: string;
    symbol: string;
    sector: string | null;
  }[];

  // Two sources, and the one you set yourself wins: a sector typed on the
  // stock's page is a correction of whatever the app worked out.
  const sectorBySymbol = new Map(
    ((companiesData ?? []) as { symbol: string; sector: string | null }[])
      .filter((c) => c.sector)
      .map((c) => [c.symbol, c.sector as string]),
  );

  for (const stock of stocks) {
    if (stock.sector) sectorBySymbol.set(stock.symbol, stock.sector);
  }

  const sectors = sectorBreakdown(valued, sectorBySymbol);
  const flags = concentrationFlags(valued, sectors);
  const unclassified = priced
    .map((h) => h.symbol)
    .filter((symbol) => !sectorBySymbol.has(symbol));
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
            {/* Today's move replaces the holdings count once prices carry a
                previous close: what changed today is the more useful figure,
                and the count is on the portfolio page anyway. */}
            {dayPercent === null ? (
              <Tile
                label="Holdings"
                value={String(holdings.length)}
                note={
                  priced.length < holdings.length
                    ? `${holdings.length - priced.length} unpriced`
                    : undefined
                }
              />
            ) : (
              <Tile
                label="Today"
                value={formatCurrency(dayAmount)}
                note={formatPercent(dayPercent)}
                tone={dayAmount >= 0 ? "positive" : "negative"}
              />
            )}
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <h2 className="text-base font-medium">Movers</h2>
              <p className="mt-0.5 text-xs text-muted">
                What each holding has made or lost you, in rupees
              </p>

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
                          className={`figure text-right ${
                            mover.amount >= 0
                              ? "text-positive"
                              : "text-negative"
                          }`}
                        >
                          {formatCurrency(mover.amount)}
                          <span className="ml-2 text-xs">
                            {formatPercent(mover.percent)}
                          </span>
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </section>

            <SectorAllocation
              sectors={sectors}
              flags={flags}
              unclassified={unclassified}
            />
          </div>

          <div className="mt-6">
            <Suspense fallback={<PortfolioVsIndexSkeleton />}>
              <PortfolioVsIndex
                holdings={priced.map((h) => ({
                  symbol: h.symbol,
                  quantity: h.quantity,
                }))}
              />
            </Suspense>
          </div>
        </>
      )}

      <DigestEmailToggle
        enabled={settings?.digest_email_enabled ?? false}
      />

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
