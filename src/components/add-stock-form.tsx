"use client";

import { useActionState, useEffect, useRef } from "react";
import { addStock, type StockFormState } from "@/app/(app)/analyzer/actions";

const initialState: StockFormState = {};

const fieldClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

export function AddStockForm() {
  const [state, formAction, pending] = useActionState(addStock, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-lg border border-border bg-surface p-4 sm:p-5"
    >
      <h2 className="text-base font-medium">Add a stock to analyse</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">
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
          <span className="stat-label">Company name (optional)</span>
          <input
            name="name"
            placeholder="Reliance Industries"
            autoComplete="off"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="stat-label">Sector (optional)</span>
          <input
            name="sector"
            placeholder="Energy"
            autoComplete="off"
            className={fieldClass}
          />
        </label>
      </div>

      {state.error && <p className="mt-4 text-sm text-negative">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add stock"}
      </button>
    </form>
  );
}
