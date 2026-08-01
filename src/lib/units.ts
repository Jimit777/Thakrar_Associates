/**
 * Indian filings state their figures in crore, lakh or million, and say so once
 * at the top of the statement. To put a figure next to a share price we have to
 * turn it back into rupees, which means knowing what that unit was worth.
 */

const MULTIPLIERS: [RegExp, number][] = [
  [/\bcrores?\b|\bcr\b/i, 10_000_000],
  [/\blakhs?\b|\blacs?\b/i, 100_000],
  [/\bmillions?\b|\bmn\b/i, 1_000_000],
  [/\bbillions?\b|\bbn\b/i, 1_000_000_000],
  [/\bthousands?\b|\b'000\b/i, 1_000],
];

/**
 * How many rupees one unit of the reported figures represents. Null when the
 * unit isn't recognised — better to show nothing than to be out by 100×.
 */
export function unitMultiplier(unit: string | null | undefined): number | null {
  if (!unit) return null;

  for (const [pattern, multiplier] of MULTIPLIERS) {
    if (pattern.test(unit)) return multiplier;
  }

  // "INR" or "Rs" on its own means the figures are already in rupees.
  if (/^\s*(inr|rs\.?|rupees|₹)\s*$/i.test(unit)) return 1;

  return null;
}

/** Large rupee amounts, written the way an Indian reader expects to see them. */
export function formatRupeeScale(value: number): string {
  const abs = Math.abs(value);
  const format = (n: number) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

  if (abs >= 10_000_000) return `${format(value / 10_000_000)} cr`;
  if (abs >= 100_000) return `${format(value / 100_000)} lakh`;
  return format(value);
}
