import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";

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
  const { data } = await supabase.from("holdings").select("quantity, avg_price");

  const holdings = data ?? [];
  const totalInvested = holdings.reduce(
    (sum, row) => sum + Number(row.quantity) * Number(row.avg_price),
    0,
  );

  const stats = [
    { label: "Invested", value: formatCurrency(totalInvested) },
    // Both depend on live prices, which arrive with the refresh button.
    { label: "Current value", value: "—" },
    { label: "Unrealised P&L", value: "—" },
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
            <p className="figure mt-2 text-2xl">{stat.value}</p>
          </div>
        ))}
      </section>

      <p className="mt-3 text-xs text-muted">
        Current value and profit or loss appear once price refresh is built.
      </p>

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
