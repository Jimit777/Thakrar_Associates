"use client";

import { useState } from "react";

export type StockTab = {
  id: string;
  label: string;
  /** Shown beside the label — number of periods, documents, calls. */
  count?: number;
  panel: React.ReactNode;
};

/**
 * The stock page had seven sections stacked vertically, so reaching the chat
 * meant scrolling past every chart and table above it.
 *
 * Panels are rendered on the server and passed in, then shown or hidden here.
 * Everything stays mounted, so switching tabs is instant and the chat keeps its
 * conversation when you look at the financials and come back.
 */
export function StockTabs({ tabs }: { tabs: StockTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Stock sections"
        className="scroll-x sticky top-0 z-20 -mx-4 mb-6 flex gap-1 border-b border-border bg-background px-4 sm:-mx-6 sm:px-6"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm transition-colors ${
                selected
                  ? "border-accent font-medium text-accent"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`ml-1.5 rounded px-1.5 py-0.5 text-[11px] ${
                    selected
                      ? "bg-accent-tint text-accent"
                      : "bg-surface-sunken text-muted"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== active}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
