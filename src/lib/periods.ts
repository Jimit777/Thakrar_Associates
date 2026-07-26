/**
 * Period labels are free text ("FY2024", "Q2 FY2025", "Q3 FY25"), so sorting
 * them alphabetically puts Q1 FY2026 before Q2 FY2025. This works out the real
 * chronology instead.
 *
 * Indian fiscal years run April–March: FY2025 covers Apr 2024 to Mar 2025, so
 * Q1 FY2025 is Apr–Jun 2024 and Q4 FY2025 is Jan–Mar 2025.
 */

const QUARTER_PATTERN = /Q\s*([1-4])\s*(?:FY|F\.Y\.?)?\s*'?\s*(\d{2,4})/i;
const YEAR_PATTERN = /(?:FY|F\.Y\.?)?\s*'?\s*(\d{4}|\d{2})\s*(?:-\s*\d{2,4})?/i;

function normaliseYear(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  // 'Q2 FY25' means FY2025.
  return raw.length <= 2 ? 2000 + value : value;
}

/**
 * A number that sorts oldest to newest. Quarters land inside their fiscal year;
 * an annual period sorts after the quarters it contains, since it covers the
 * whole year.
 */
export function periodSortKey(label: string): number | null {
  const quarterMatch = label.match(QUARTER_PATTERN);

  if (quarterMatch) {
    const quarter = Number(quarterMatch[1]);
    const year = normaliseYear(quarterMatch[2]);
    if (year === null) return null;
    return year * 10 + quarter;
  }

  const yearMatch = label.match(YEAR_PATTERN);
  if (yearMatch) {
    const year = normaliseYear(yearMatch[1]);
    if (year === null) return null;
    return year * 10 + 9;
  }

  return null;
}

/**
 * Oldest first — the order charts read naturally left to right, and the order a
 * financial table is normally printed in.
 *
 * Labels we can't parse keep their original relative order and go last, so an
 * unusual label is visible rather than silently reordered.
 */
export function sortByPeriod<T extends { period_label: string }>(rows: T[]): T[] {
  return [...rows]
    .map((row, index) => ({ row, index, key: periodSortKey(row.period_label) }))
    .sort((a, b) => {
      if (a.key === null && b.key === null) return a.index - b.index;
      if (a.key === null) return 1;
      if (b.key === null) return -1;
      return a.key - b.key || a.index - b.index;
    })
    .map((entry) => entry.row);
}
