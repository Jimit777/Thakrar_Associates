"use client";

import { useActionState, useEffect, useState } from "react";
import {
  deleteHolding,
  updateHolding,
  type HoldingFormState,
} from "@/app/(app)/portfolio/actions";
import { formatCurrency, formatQuantity, formatPercent } from "@/lib/format";
import {
  currentValue,
  investedValue,
  profitAndLoss,
  type Holding,
} from "@/types/holding";

const initialState: HoldingFormState = {};

const cellClass = "px-4 py-3 text-sm";
const editFieldClass =
  "w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent";

function pnlColour(amount: number) {
  return amount > 0 ? "text-positive" : amount < 0 ? "text-negative" : "";
}

/**
 * Eight columns of figures will not fit on a phone, so below `md` the same
 * holdings are drawn as stacked cards instead of a table that scrolls sideways.
 */
export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <>
      <div className="space-y-3 md:hidden">
        {holdings.map((holding) =>
          editingId === holding.id ? (
            <EditCard
              key={holding.id}
              holding={holding}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <DisplayCard
              key={holding.id}
              holding={holding}
              onEdit={() => setEditingId(holding.id)}
            />
          ),
        )}
      </div>

      <div className="scroll-x hidden rounded-lg border border-border md:block">
        <table className="w-full min-w-4xl border-collapse bg-surface">
          <thead>
            <tr className="border-b border-border bg-surface-sunken text-left">
              <th className={`${cellClass} stat-label`}>Stock</th>
              <th className={`${cellClass} stat-label text-right`}>Quantity</th>
              <th className={`${cellClass} stat-label text-right`}>Avg price</th>
              <th className={`${cellClass} stat-label text-right`}>Invested</th>
              <th className={`${cellClass} stat-label text-right`}>Price</th>
              <th className={`${cellClass} stat-label text-right`}>Value</th>
              <th className={`${cellClass} stat-label text-right`}>P&amp;L</th>
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
    </>
  );
}

function DeleteButton({ holding }: { holding: Holding }) {
  return (
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
  );
}

function DisplayCard({
  holding,
  onEdit,
}: {
  holding: Holding;
  onEdit: () => void;
}) {
  const value = currentValue(holding);
  const pnl = profitAndLoss(holding);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{holding.symbol}</p>
          <p className="text-xs text-muted">{holding.exchange}</p>
        </div>

        {pnl === null ? (
          <span className="text-sm text-muted">not priced</span>
        ) : (
          <div className={`text-right ${pnlColour(pnl.amount)}`}>
            <p className="figure text-lg">{formatCurrency(pnl.amount)}</p>
            <p className="figure text-xs">{formatPercent(pnl.percent)}</p>
          </div>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {(
          [
            ["Quantity", formatQuantity(holding.quantity)],
            ["Avg price", formatCurrency(holding.avg_price)],
            [
              "Price",
              holding.last_price === null
                ? "—"
                : formatCurrency(holding.last_price),
            ],
            ["Value", value === null ? "—" : formatCurrency(value)],
          ] as const
        ).map(([label, text]) => (
          <div key={label}>
            <dt className="stat-label">{label}</dt>
            <dd className="figure text-sm">{text}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded border border-border px-3 py-1.5 text-xs transition-colors hover:border-accent hover:text-accent"
        >
          Edit
        </button>
        <DeleteButton holding={holding} />
      </div>
    </div>
  );
}

function EditCard({
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
    <form
      action={formAction}
      className="rounded-lg border border-accent bg-surface p-4"
    >
      <input type="hidden" name="id" value={holding.id} />

      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          <span className="stat-label">Symbol</span>
          <input
            name="symbol"
            defaultValue={holding.symbol}
            className={`${editFieldClass} uppercase`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="stat-label">Exchange</span>
          <select
            name="exchange"
            defaultValue={holding.exchange}
            className={editFieldClass}
          >
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="stat-label">Quantity</span>
          <input
            name="quantity"
            type="number"
            step="any"
            min="0"
            defaultValue={holding.quantity}
            className={`${editFieldClass} figure`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="stat-label">Avg price</span>
          <input
            name="avg_price"
            type="number"
            step="any"
            min="0"
            defaultValue={holding.avg_price}
            className={`${editFieldClass} figure`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="stat-label">Buy date</span>
          <input
            name="buy_date"
            type="date"
            defaultValue={holding.buy_date ?? ""}
            className={`${editFieldClass} figure`}
          />
        </label>
      </div>

      {state.error && <p className="mt-3 text-xs text-negative">{state.error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded border border-border px-3 py-1.5 text-xs transition-colors hover:border-accent hover:text-accent"
        >
          Cancel
        </button>
      </div>

      <p className="mt-2 text-xs text-muted">Refresh prices again after saving.</p>
    </form>
  );
}

function DisplayRow({
  holding,
  onEdit,
}: {
  holding: Holding;
  onEdit: () => void;
}) {
  const value = currentValue(holding);
  const pnl = profitAndLoss(holding);

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
      <td className={`${cellClass} figure text-right`}>
        {holding.last_price === null ? (
          <span className="text-muted">—</span>
        ) : (
          formatCurrency(holding.last_price)
        )}
      </td>
      <td className={`${cellClass} figure text-right`}>
        {value === null ? (
          <span className="text-muted">—</span>
        ) : (
          formatCurrency(value)
        )}
      </td>
      <td
        className={`${cellClass} figure text-right ${
          pnl === null ? "" : pnlColour(pnl.amount)
        }`}
      >
        {pnl === null ? (
          <span className="text-muted">—</span>
        ) : (
          <>
            <div>{formatCurrency(pnl.amount)}</div>
            <div className="text-xs">{formatPercent(pnl.percent)}</div>
          </>
        )}
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
          <DeleteButton holding={holding} />
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

  // A <form> cannot wrap table cells, so the fields sit in the row and point at
  // a form element by id. The id carries the holding's own id to stay unique.
  const formId = `edit-holding-${holding.id}`;

  return (
    <tr className="border-b border-border bg-surface-sunken last:border-0">
      <td className={cellClass}>
        <input type="hidden" name="id" value={holding.id} form={formId} />
        <input
          name="symbol"
          defaultValue={holding.symbol}
          form={formId}
          className={`${editFieldClass} uppercase`}
        />
        <select
          name="exchange"
          defaultValue={holding.exchange}
          form={formId}
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
          form={formId}
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
          form={formId}
          className={`${editFieldClass} figure text-right`}
        />
      </td>

      <td className={cellClass}>
        <input
          name="buy_date"
          type="date"
          defaultValue={holding.buy_date ?? ""}
          form={formId}
          className={`${editFieldClass} figure`}
        />
      </td>

      <td className={`${cellClass} text-right text-xs text-muted`} colSpan={2}>
        refresh again after saving
      </td>

      <td className={`${cellClass} text-right`} colSpan={2}>
        <form id={formId} action={formAction} />
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            form={formId}
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
