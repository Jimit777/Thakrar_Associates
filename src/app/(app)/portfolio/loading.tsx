import {
  CardSkeleton,
  HeadingSkeleton,
  TableSkeleton,
} from "@/components/skeleton";

export default function PortfolioLoading() {
  return (
    <>
      <HeadingSkeleton />
      <CardSkeleton lines={2} />
      <div className="mt-8">
        <TableSkeleton rows={5} />
      </div>
    </>
  );
}
