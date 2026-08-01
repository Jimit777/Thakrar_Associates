"use client";

import { useActionState, useEffect, useRef } from "react";
import { addHolding, type HoldingFormState } from "@/app/(app)/portfolio/actions";

const initialState: HoldingFormState = {};

const fieldClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

export function AddHoldingForm() {
  const [state, formAction, pending] = useActionState(addHolding, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a holding is saved, ready for the next entry.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-lg border border-border bg-surface p-4 sm:p-5"
    >
      <h2 className="text-base font-medium">Add a holding</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1.5 text-sm lg:col-span-1">
          <span className="stat-label">Symbol</span>
          <input
            name="symbol"
            required
            placeholder="RELIANCE"
            autoComplete="off"
            className={`${fieldClass} uppercase`}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="stat-label">Exchange</span>
          <select name="exchange" defaultValue="NSE" className={fieldClass}>
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="stat-label">Quantity</span>
          <input
            name="quantity"
            type="number"
            required
            min="0"
            step="any"
            placeholder="10"
            className={`${fieldClass} figure`}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="stat-label">Avg buy price</span>
          <input
            name="avg_price"
            type="number"
            required
            min="0"
            step="any"
            placeholder="1450.50"
            className={`${fieldClass} figure`}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="stat-label">Buy date</span>
          <input name="buy_date" type="date" className={`${fieldClass} figure`} />
          <span className="text-xs text-muted">Needed for annualised return</span>
        </label>
      </div>

      {/* The reason for a purchase is the only part of a holding you cannot
          reconstruct later from the numbers. */}
      <label className="mt-4 flex flex-col gap-1.5 text-sm">
        <span className="stat-label">Why you&apos;re buying it (optional)</span>
        <textarea
          name="thesis"
          rows={2}
          placeholder="What you expect to happen, and roughly by when. Six months from now this is what you'll check the position against."
          className={`${fieldClass} resize-y`}
        />
      </label>

      {state.error && (
        <p className="mt-4 text-sm text-negative">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add holding"}
      </button>
    </form>
  );
}
