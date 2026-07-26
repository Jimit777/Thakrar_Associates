"use client";

import { useActionState, useEffect, useState } from "react";
import {
  deleteHolding,
  updateHolding,
  type HoldingFormState,
} from "@/app/(app)/portfolio/actions";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { investedValue, type Holding } from "@/types/holding";

const initialState: HoldingFormState = {};

const cellClass = "px-4 py-3 text-sm";
const editFieldClass =
  "w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent";

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-3xl border-collapse bg-surface">
        <thead>
          <tr className="border-b border-border bg-surface-sunken text-left">
            <th className={`${cellClass} stat-label`}>Stock</th>
            <th className={`${cellClass} stat-label text-right`}>Quantity</th>
            <th className={`${cellClass} stat-label text-right`}>Avg price</th>
            <th className={`${cellClass} stat-label text-right`}>Invested</th>
            <th className={`${cellClass} stat-label`}>Buy date</th>
            <th className={`${cellClass} stat-label text-right`}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {holdings.map((holding) =>
            editingId === holding.id ? (
              <EditRow
                key={holding.id}
                holding={holding}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <DisplayRow
                key={holding.id}
                holding={holding}
                onEdit={() => setEditingId(holding.id)}
              />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function DisplayRow({
  holding,
  onEdit,
}: {
  holding: Holding;
  onEdit: () => void;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className={cellClass}>
        <span className="font-medium">{holding.symbol}</span>
        <span className="ml-2 text-xs text-muted">{holding.exchange}</span>
      </td>
      <td className={`${cellClass} figure text-right`}>
        {formatQuantity(holding.quantity)}
      </td>
      <td className={`${cellClass} figure text-right`}>
        {formatCurrency(holding.avg_price)}
      </td>
      <td className={`${cellClass} figure text-right`}>
        {formatCurrency(investedValue(holding))}
      </td>
      <td className={`${cellClass} figure text-muted`}>
        {holding.buy_date ?? "—"}
      </td>
      <td className={`${cellClass} text-right`}>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded border border-border px-2 py-1 text-xs transition-colors hover:border-accent hover:text-accent"
          >
            Edit
          </button>

          <form
            action={deleteHolding}
            onSubmit={(event) => {
              if (!confirm(`Remove ${holding.symbol} from your portfolio?`)) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={holding.id} />
            <button
              type="submit"
              className="rounded border border-border px-2 py-1 text-xs transition-colors hover:border-negative hover:text-negative"
            >
              Delete
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

function EditRow({
  holding,
  onDone,
}: {
  holding: Holding;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateHolding,
    initialState,
  );

  useEffect(() => {
    if (state.success) onDone();
  }, [state, onDone]);

  return (
    <tr className="border-b border-border bg-surface-sunken last:border-0">
      <td className={cellClass}>
        <input type="hidden" name="id" value={holding.id} form="edit-holding" />
        <input
          name="symbol"
          defaultValue={holding.symbol}
          form="edit-holding"
          className={`${editFieldClass} uppercase`}
        />
        <select
          name="exchange"
          defaultValue={holding.exchange}
          form="edit-holding"
          className={`${editFieldClass} mt-1`}
        >
          <option value="NSE">NSE</option>
          <option value="BSE">BSE</option>
        </select>
      </td>

      <td className={cellClass}>
        <input
          name="quantity"
          type="number"
          step="any"
          min="0"
          defaultValue={holding.quantity}
          form="edit-holding"
          className={`${editFieldClass} figure text-right`}
        />
      </td>

      <td className={cellClass}>
        <input
          name="avg_price"
          type="number"
          step="any"
          min="0"
          defaultValue={holding.avg_price}
          form="edit-holding"
          className={`${editFieldClass} figure text-right`}
        />
      </td>

      <td className={`${cellClass} text-right text-xs text-muted`}>
        recalculated on save
      </td>

      <td className={cellClass}>
        <input
          name="buy_date"
          type="date"
          defaultValue={holding.buy_date ?? ""}
          form="edit-holding"
          className={`${editFieldClass} figure`}
        />
      </td>

      <td className={`${cellClass} text-right`}>
        <form id="edit-holding" action={formAction} />
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            form="edit-holding"
            disabled={pending}
            className="rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded border border-border px-2 py-1 text-xs transition-colors hover:border-accent hover:text-accent"
          >
            Cancel
          </button>
        </div>
        {state.error && (
          <p className="mt-1 text-xs text-negative">{state.error}</p>
        )}
      </td>
    </tr>
  );
}
