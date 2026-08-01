import type { PricePoint } from "@/lib/prices";

/**
 * The questions a total can't answer: where the money actually sits, whether
 * too much of it sits in one place, and which holdings moved the needle in
 * rupees rather than in percent.
 *
 * All arithmetic, no model calls.
 */

export type ValuedHolding = {
  symbol: string;
  quantity: number;
  avgPrice: number;
  lastPrice: number | null;
};

export type SectorSlice = {
  sector: string;
  value: number;
  percent: number;
  symbols: string[];
};

const UNCLASSIFIED = "Unclassified";

/**
 * Portfolio value grouped by sector, largest first.
 *
 * Only priced holdings count: an unpriced one has no current value, and
 * counting it at cost would quietly mix two different measures.
 */
export function sectorBreakdown(
  holdings: ValuedHolding[],
  sectorBySymbol: Map<string, string>,
): SectorSlice[] {
  const byName = new Map<string, { value: number; symbols: string[] }>();
  let total = 0;

  for (const holding of holdings) {
    if (holding.lastPrice === null) continue;

    const value = holding.quantity * holding.lastPrice;
    const sector = sectorBySymbol.get(holding.symbol)?.trim() || UNCLASSIFIED;
    const entry = byName.get(sector) ?? { value: 0, symbols: [] };

    entry.value += value;
    entry.symbols.push(holding.symbol);
    byName.set(sector, entry);
    total += value;
  }

  if (total === 0) return [];

  return [...byName.entries()]
    .map(([sector, entry]) => ({
      sector,
      value: entry.value,
      percent: (entry.value / total) * 100,
      symbols: entry.symbols.sort(),
    }))
    .sort((a, b) => b.value - a.value);
}

export type Concentration = {
  /** Plain-English warning, or null when nothing stands out. */
  message: string;
  kind: "stock" | "sector";
};

/**
 * Flags a portfolio leaning hard on one position or one sector.
 *
 * A quarter of everything in one place is the threshold — high enough not to
 * fire on a normal ten-stock portfolio, low enough to catch a real problem.
 * This is an observation, not advice: concentration is a choice, and plenty of
 * people make it deliberately.
 */
export function concentrationFlags(
  holdings: ValuedHolding[],
  sectors: SectorSlice[],
): Concentration[] {
  const priced = holdings.filter((holding) => holding.lastPrice !== null);
  const total = priced.reduce(
    (sum, holding) => sum + holding.quantity * (holding.lastPrice ?? 0),
    0,
  );

  if (total === 0 || priced.length < 2) return [];

  const flags: Concentration[] = [];

  const biggest = priced
    .map((holding) => ({
      symbol: holding.symbol,
      percent: ((holding.quantity * (holding.lastPrice ?? 0)) / total) * 100,
    }))
    .sort((a, b) => b.percent - a.percent)[0];

  if (biggest && biggest.percent >= 25) {
    flags.push({
      kind: "stock",
      message: `${biggest.symbol} is ${biggest.percent.toFixed(0)}% of your portfolio. What happens to it happens to you.`,
    });
  }

  // A single-sector portfolio isn't a concentration warning, it's the whole
  // portfolio — saying so adds nothing.
  const named = sectors.filter((slice) => slice.sector !== UNCLASSIFIED);
  const topSector = named[0];

  if (named.length > 1 && topSector && topSector.percent >= 40) {
    flags.push({
      kind: "sector",
      message: `${topSector.percent.toFixed(0)}% sits in ${topSector.sector}. Those holdings tend to fall together.`,
    });
  }

  return flags;
}

export type Mover = {
  symbol: string;
  percent: number;
  /** Gain or loss in rupees — what the percentage is actually worth. */
  amount: number;
};

/**
 * Holdings ranked by what they contributed in money.
 *
 * A 40% gain on a small position moves less than a 2% gain on a large one, so
 * ranking by percentage puts the least consequential holdings at the top.
 */
export function moversByContribution(holdings: ValuedHolding[]): Mover[] {
  return holdings
    .filter((holding) => holding.lastPrice !== null)
    .map((holding) => {
      const invested = holding.quantity * holding.avgPrice;
      const amount = holding.quantity * (holding.lastPrice ?? 0) - invested;

      return {
        symbol: holding.symbol,
        amount,
        percent: invested === 0 ? 0 : (amount / invested) * 100,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export type IndexedPoint = { date: string; portfolio: number; index: number };

/**
 * Rebases the portfolio and an index to 100 on the same day, so the two can be
 * read against each other on one axis.
 *
 * The series starts on the latest date at which *every* holding has a price,
 * because a curve that adds a holding partway through is measuring two
 * different portfolios and comparing them to one benchmark.
 *
 * It assumes today's quantities were held throughout — the app stores one
 * average price per holding, not a transaction history. Anything bought or
 * sold during the window makes this an approximation, and the page says so.
 */
export function rebaseAgainstIndex(
  holdings: { quantity: number; points: PricePoint[] }[],
  indexPoints: PricePoint[],
): IndexedPoint[] {
  if (holdings.length === 0 || indexPoints.length < 2) return [];

  const starts = holdings.map((holding) => holding.points[0]?.date);
  if (starts.some((date) => !date)) return [];

  const start = starts.sort().at(-1)!;

  // One lookup table per holding, plus its dates in order, so finding the last
  // known close on or before a given day is a scan rather than a search.
  const series = holdings.map((holding) => ({
    quantity: holding.quantity,
    closes: new Map(holding.points.map((point) => [point.date, point.close])),
    dates: holding.points.map((point) => point.date),
  }));

  const spine = indexPoints.filter((point) => point.date >= start);
  if (spine.length < 2) return [];

  const cursors = series.map(() => 0);
  const lastKnown = series.map(() => null as number | null);
  const values: { date: string; value: number }[] = [];

  for (const point of spine) {
    let total = 0;
    let complete = true;

    series.forEach((entry, index) => {
      // Advance to the most recent trading day at or before this one. Holidays
      // differ between a stock and the index, so dates never line up exactly.
      while (
        cursors[index] < entry.dates.length &&
        entry.dates[cursors[index]] <= point.date
      ) {
        lastKnown[index] = entry.closes.get(entry.dates[cursors[index]]) ?? null;
        cursors[index] += 1;
      }

      if (lastKnown[index] === null) complete = false;
      else total += entry.quantity * lastKnown[index]!;
    });

    if (complete) values.push({ date: point.date, value: total });
  }

  if (values.length < 2) return [];

  const baseValue = values[0].value;
  const baseIndex = spine.find((point) => point.date === values[0].date)?.close;

  if (!baseValue || !baseIndex) return [];

  const indexByDate = new Map(spine.map((point) => [point.date, point.close]));

  return values.map((entry) => ({
    date: entry.date,
    portfolio: (entry.value / baseValue) * 100,
    index: ((indexByDate.get(entry.date) ?? baseIndex) / baseIndex) * 100,
  }));
}
