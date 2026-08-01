import {
  CardSkeleton,
  HeadingSkeleton,
  TilesSkeleton,
} from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <HeadingSkeleton />
      <TilesSkeleton />
      <CardSkeleton className="mt-6" lines={5} />
    </>
  );
}
