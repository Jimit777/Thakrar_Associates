import Link from "next/link";
import { PageHeading } from "@/components/page-heading";

/**
 * Figures are intentionally blank until holdings and price refresh exist
 * (Milestones 2 and 3). Nothing here is placeholder *data* — only the layout.
 */
const STATS = [
  { label: "Invested", value: "—" },
  { label: "Current value", value: "—" },
  { label: "Unrealised P&L", value: "—" },
  { label: "Holdings", value: "0" },
];

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

export default function DashboardPage() {
  return (
    <>
      <PageHeading
        title="Dashboard"
        subtitle="An overview of your portfolio and research."
      />

      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-surface px-5 py-4">
            <p className="stat-label">{stat.label}</p>
            <p className="figure mt-2 text-2xl">{stat.value}</p>
          </div>
        ))}
      </section>

      <p className="mt-3 text-xs text-muted">
        Figures appear once you add holdings and refresh prices.
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
