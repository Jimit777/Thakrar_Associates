import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatPercent } from "@/lib/format";

const PANELS = [
  {
    href: "/portfolio",
    title: "Portfolio",
    body: "Add your holdings by hand, then refresh to pull live prices and see profit or loss.",
  },
  {
    href: "/news",
    title: "News",
    body: "Sector and stock-specific headlines, national and global.",
  },
  {
    href: "/analyzer",
    title: "Analyzer",
    body: "Upload annual and quarterly reports, review the extracted financials, and ask questions.",
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("holdings")
    .select("quantity, avg_price, last_price");

  const holdings = (data ?? []).map((row) => ({
    quantity: Number(row.quantity),
    avg_price: Number(row.avg_price),
    last_price: row.last_price === null ? null : Number(row.last_price),
  }));

  const totalInvested = holdings.reduce(
    (sum, row) => sum + row.quantity * row.avg_price,
    0,
  );

  // Only priced holdings count, so a missing price can't understate the total.
  const priced = holdings.filter((row) => row.last_price !== null);
  const totalCurrent = priced.reduce(
    (sum, row) => sum + row.quantity * (row.last_price ?? 0),
    0,
  );
  const pricedInvested = priced.reduce(
    (sum, row) => sum + row.quantity * row.avg_price,
    0,
  );
  const pnl = totalCurrent - pricedInvested;
  const pnlPercent = pricedInvested === 0 ? 0 : (pnl / pricedInvested) * 100;

  const hasPrices = priced.length > 0;

  const stats = [
    { label: "Invested", value: formatCurrency(totalInvested) },
    {
      label: "Current value",
      value: hasPrices ? formatCurrency(totalCurrent) : "—",
    },
    {
      label: "Unrealised P&L",
      value: hasPrices ? formatCurrency(pnl) : "—",
      note: hasPrices ? formatPercent(pnlPercent) : undefined,
      tone: hasPrices ? (pnl >= 0 ? "positive" : "negative") : undefined,
    },
    { label: "Holdings", value: String(holdings.length) },
  ];

  return (
    <>
      <PageHeading
        title="Dashboard"
        subtitle="An overview of your portfolio and research."
      />

      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface px-5 py-4">
            <p className="stat-label">{stat.label}</p>
            <p
              className={`figure mt-2 text-2xl ${
                stat.tone === "positive"
                  ? "text-positive"
                  : stat.tone === "negative"
                    ? "text-negative"
                    : ""
              }`}
            >
              {stat.value}
            </p>
            {stat.note && (
              <p
                className={`figure text-xs ${
                  stat.tone === "positive" ? "text-positive" : "text-negative"
                }`}
              >
                {stat.note}
              </p>
            )}
          </div>
        ))}
      </section>

      {!hasPrices && (
        <p className="mt-3 text-xs text-muted">
          Current value and profit or loss appear once you refresh prices on the
          portfolio page.
        </p>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {PANELS.map((panel) => (
          <Link
            key={panel.href}
            href={panel.href}
            className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent"
          >
            <h2 className="text-lg font-medium">{panel.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {panel.body}
            </p>
          </Link>
        ))}
      </section>
    </>
  );
}
