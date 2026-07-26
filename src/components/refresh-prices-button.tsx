"use client";

import { useState, useTransition } from "react";
import { refreshPrices, type RefreshState } from "@/app/(app)/portfolio/actions";

export function RefreshPricesButton({
  lastRefreshedAt,
}: {
  lastRefreshedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RefreshState | null>(null);

  function onClick() {
    startTransition(async () => {
      setResult(await refreshPrices());
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Refreshing…" : "Refresh prices"}
      </button>

      {result?.error && <p className="text-xs text-negative">{result.error}</p>}

      {result?.failed && result.failed.length > 0 && (
        <p className="max-w-xs text-right text-xs text-negative">
          Couldn&apos;t find a price for {result.failed.join(", ")}. Check the
          symbol matches the exchange ticker.
        </p>
      )}

      {lastRefreshedAt && !pending && (
        <p className="text-xs text-muted">
          Updated {formatRefreshedAt(lastRefreshedAt)}
        </p>
      )}
    </div>
  );
}

/** Fixed to IST so the server and browser always render the same text. */
function formatRefreshedAt(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}
