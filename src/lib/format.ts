/**
 * Rupee amounts, grouped the Indian way (1,20,000 rather than 120,000).
 *
 * No currency symbol: neither of the app's fonts contains a rupee sign, so it
 * was drawn by whatever font the operating system substituted — different on
 * every machine and visibly foreign. Everything here is in rupees, and column
 * headers say so where it isn't obvious.
 */
export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);
}

/** Percentages, always signed so gains and losses read clearly. */
export function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/** Share counts: whole numbers stay whole, fractions keep their decimals. */
export function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 4,
  }).format(value);
}
