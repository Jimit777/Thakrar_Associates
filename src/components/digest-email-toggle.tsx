"use client";

import { useState, useTransition } from "react";
import { setDigestEmail } from "@/app/(app)/settings";

/**
 * Off unless switched on: anything that sends mail on a schedule without being
 * asked should have to be asked for.
 *
 * Optimistic, because a switch that waits half a second before moving feels
 * broken. It springs back if the save fails.
 */
export function DigestEmailToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);

    startTransition(async () => {
      const result = await setDigestEmail(next);
      if (result.error) {
        setOn(!next);
        setError(result.error);
      }
    });
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="max-w-md">
          <h2 className="text-base font-medium">Email me the daily digest</h2>
          <p className="mt-0.5 text-sm text-muted">
            {on
              ? "Sent every weekday at 07:15, before the market opens. Each one is a model call with six web searches, so this is the app's main recurring cost."
              : "Off. The digest is still built for you to read on the News page — this only controls whether it also arrives by email."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Email me the daily digest"
          onClick={toggle}
          disabled={pending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            on ? "bg-accent" : "bg-border-strong"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface transition-all ${
              on ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}
    </section>
  );
}
