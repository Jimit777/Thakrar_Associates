"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type PaletteItem = {
  label: string;
  hint: string;
  href: string;
};

const PAGES: PaletteItem[] = [
  { label: "Dashboard", hint: "Portfolio at a glance", href: "/" },
  { label: "Portfolio", hint: "Holdings and returns", href: "/portfolio" },
  { label: "News", hint: "Sector digest and search", href: "/news" },
  { label: "Analyzer", hint: "All researched stocks", href: "/analyzer" },
];

/**
 * Jump to any stock or page without going through the nav.
 *
 * Once there are more than a handful of stocks, reaching one means Analyzer,
 * find it in the grid, click. This is two keystrokes and the first letters of
 * the symbol.
 */
export function CommandPalette({ stocks }: { stocks: PaletteItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        setQuery("");
        setActive(0);
      }
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const results = useMemo(() => {
    const all = [...stocks, ...PAGES];
    const needle = query.trim().toLowerCase();
    if (!needle) return all.slice(0, 8);

    return all
      .filter(
        (item) =>
          item.label.toLowerCase().includes(needle) ||
          item.hint.toLowerCase().includes(needle),
      )
      // A symbol that starts with what you typed is what you meant.
      .sort((a, b) => {
        const aStarts = a.label.toLowerCase().startsWith(needle) ? 0 : 1;
        const bStarts = b.label.toLowerCase().startsWith(needle) ? 0 : 1;
        return aStarts - bStarts;
      })
      .slice(0, 8);
  }, [query, stocks]);

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/20 px-4 pt-[12vh]"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Jump to"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((current) => Math.min(current + 1, results.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => Math.max(current - 1, 0));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              go(results[active]);
            }
          }}
          placeholder="Jump to a stock or page…"
          className="w-full border-b border-border bg-surface px-4 py-3 text-sm outline-none"
        />

        {results.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            Nothing matching &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {results.map((item, index) => (
              <li key={item.href}>
                <button
                  type="button"
                  onClick={() => go(item)}
                  onMouseEnter={() => setActive(index)}
                  className={`flex w-full items-baseline justify-between gap-4 px-4 py-2 text-left text-sm ${
                    index === active ? "bg-surface-sunken" : ""
                  }`}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="truncate text-xs text-muted">
                    {item.hint}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="border-t border-border px-4 py-2 text-[11px] text-muted">
          ↑↓ to move · Enter to open · Esc to close
        </p>
      </div>
    </div>
  );
}
