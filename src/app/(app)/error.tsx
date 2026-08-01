"use client";

import { useEffect } from "react";

/**
 * Catches anything that throws while rendering a signed-in page, so a failed
 * query shows a page you can retry from rather than a blank screen.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-lg border border-border bg-surface px-5 py-12 text-center sm:px-6 sm:py-16">
      <p className="text-lg font-medium">Something went wrong</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {error.message || "This page could not be loaded."}
      </p>

      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Try again
      </button>

      {error.digest && (
        <p className="figure mt-4 text-xs text-muted">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
