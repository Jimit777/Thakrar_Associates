import { PageHeading, EmptyState } from "@/components/page-heading";

export default function AnalyzerPage() {
  return (
    <>
      <PageHeading
        title="Analyzer"
        subtitle="Financials, concall summaries, and AI chat for a single stock."
      />
      <EmptyState
        title="Nothing to analyse yet"
        description="Report uploads, extracted financials, and the stock chat come after the portfolio is done."
      />
    </>
  );
}
