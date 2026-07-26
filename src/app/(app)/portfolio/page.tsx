import { PageHeading, EmptyState } from "@/components/page-heading";

export default function PortfolioPage() {
  return (
    <>
      <PageHeading
        title="Portfolio"
        subtitle="Your holdings, entered manually and priced on demand."
      />
      <EmptyState
        title="No holdings yet"
        description="Adding holdings and the price refresh button arrive in the next milestone."
      />
    </>
  );
}
