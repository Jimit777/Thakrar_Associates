import { PageHeading, EmptyState } from "@/components/page-heading";

export default function NewsPage() {
  return (
    <>
      <PageHeading
        title="News"
        subtitle="Sector and stock news, national and global."
      />
      <EmptyState
        title="No news yet"
        description="The news feed is built after the portfolio and analyzer sections are working."
      />
    </>
  );
}
