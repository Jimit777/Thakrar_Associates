import { CardSkeleton, HeadingSkeleton } from "@/components/skeleton";

export default function AnalyzerLoading() {
  return (
    <>
      <HeadingSkeleton />
      <CardSkeleton lines={2} />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <CardSkeleton key={index} lines={2} />
        ))}
      </div>
    </>
  );
}
