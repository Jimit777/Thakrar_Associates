"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { classifySectors } from "@/app/(app)/classify-sectors";

export function ClassifySectorsButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await classifySectors();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {pending
          ? "Classifying…"
          : `Classify ${count} ${count === 1 ? "holding" : "holdings"}`}
      </button>
      {error && <p className="mt-1 text-xs text-negative">{error}</p>}
    </>
  );
}
