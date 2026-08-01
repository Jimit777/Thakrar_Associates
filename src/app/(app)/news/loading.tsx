import { CardSkeleton, HeadingSkeleton } from "@/components/skeleton";

export default function NewsLoading() {
  return (
    <>
      <HeadingSkeleton />
      <CardSkeleton lines={2} />
      <div className="mt-6 space-y-4">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    </>
  );
}
