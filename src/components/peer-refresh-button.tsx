"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generatePeers } from "@/app/(app)/analyzer/peers";

/**
 * The only interactive part of the peer table — everything else is computed on
 * the server from the price feed, so it doesn't need to be a client component.
 */
export function PeerRefreshButton({
  stockId,
  hasPeers,
}: {
  stockId: string;
  hasPeers: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await generatePeers(stockId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {pending ? "Finding…" : hasPeers ? "Change peers" : "Find peers"}
      </button>
      {error && <p className="max-w-xs text-right text-xs text-negative">{error}</p>}
    </div>
  );
}
