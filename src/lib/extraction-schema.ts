import { z } from "zod";

/**
 * Every figure is nullable on purpose: a report that doesn't disclose a line
 * item should come back as null rather than a guess. Quarterly filings in
 * particular rarely carry a balance sheet or cash flow statement.
 */
const money = z.number().nullable();

export type Section = {
  key: "income_statement" | "balance_sheet" | "cash_flow";
  title: string;
  items: { key: string; label: string }[];
};

export const SECTIONS: Section[] = [
  {
    key: "income_statement",
    title: "Profit & loss",
    items: [
      { key: "revenue", label: "Revenue" },
      { key: "other_income", label: "Other income" },
      { key: "total_expenses", label: "Total expenses" },
      { key: "operating_profit", label: "Operating profit" },
      { key: "depreciation", label: "Depreciation" },
      { key: "interest", label: "Interest" },
      { key: "profit_before_tax", label: "Profit before tax" },
      { key: "tax", label: "Tax" },
      { key: "net_profit", label: "Net profit" },
      { key: "eps", label: "EPS" },
    ],
  },
  {
    key: "balance_sheet",
    title: "Balance sheet",
    items: [
      { key: "equity_capital", label: "Equity capital" },
      { key: "reserves", label: "Reserves" },
      { key: "borrowings", label: "Borrowings" },
      { key: "other_liabilities", label: "Other liabilities" },
      { key: "total_liabilities", label: "Total liabilities" },
      { key: "fixed_assets", label: "Fixed assets" },
      { key: "capital_work_in_progress", label: "Capital work in progress" },
      { key: "investments", label: "Investments" },
      { key: "other_assets", label: "Other assets" },
      { key: "total_assets", label: "Total assets" },
    ],
  },
  {
    key: "cash_flow",
    title: "Cash flow",
    items: [
      { key: "cash_from_operating", label: "Cash from operating activity" },
      { key: "cash_from_investing", label: "Cash from investing activity" },
      { key: "cash_from_financing", label: "Cash from financing activity" },
      { key: "net_cash_flow", label: "Net cash flow" },
    ],
  },
];

const IncomeStatementSchema = z.object({
  revenue: money,
  other_income: money,
  total_expenses: money,
  operating_profit: money,
  depreciation: money,
  interest: money,
  profit_before_tax: money,
  tax: money,
  net_profit: money,
  eps: money.describe("Earnings per share — per share, not in the unit above."),
});

const BalanceSheetSchema = z.object({
  equity_capital: money,
  reserves: money,
  borrowings: money.describe("Total debt: short term plus long term."),
  other_liabilities: money,
  total_liabilities: money,
  fixed_assets: money.describe("Net block of property, plant and equipment."),
  capital_work_in_progress: money,
  investments: money,
  other_assets: money,
  total_assets: money,
});

const CashFlowSchema = z.object({
  cash_from_operating: money,
  cash_from_investing: money,
  cash_from_financing: money,
  net_cash_flow: money,
});

/**
 * Segment disclosure is where an annual report says what the business is
 * actually made of. It sits in the notes rather than in the statements, so it
 * is captured separately from the three sections above.
 */
const SegmentSchema = z.object({
  name: z.string().describe("The segment's name, exactly as the report calls it."),
  kind: z
    .enum(["business", "geography"])
    .describe(
      "'business' for product or service segments, 'geography' for regions or countries.",
    ),
  revenue: money.describe("Segment revenue, in the same unit as everything else."),
  profit: money.describe(
    "Segment result — profit before unallocated items, interest and tax, if the report discloses it per segment.",
  ),
});

export const PeriodSchema = z.object({
  period_label: z
    .string()
    .describe("The period, written as FY2024 for a year or Q2 FY2025 for a quarter."),
  period_type: z.enum(["annual", "quarterly"]),
  basis: z
    .enum(["consolidated", "standalone", "unknown"])
    .describe(
      "Whether these particular figures are consolidated or standalone. A report that presents both produces two entries for the same period — one of each.",
    ),
  income_statement: IncomeStatementSchema,
  balance_sheet: BalanceSheetSchema,
  cash_flow: CashFlowSchema,
  shares_outstanding: z
    .number()
    .nullable()
    .describe(
      "Number of equity shares outstanding at the end of the period, as a plain count of shares. NOT in the currency unit above, and NOT in crore, lakh or million. A report saying '65,00,00,000 equity shares' returns 650000000; one saying '6.50 crore shares' returns 65000000. Found in the share capital note or the earnings-per-share note. Null if not stated.",
    ),
  segments: z
    .array(SegmentSchema)
    .describe(
      "Segment-wise revenue and results for this period, from the segment reporting note. Empty array if the report does not disclose segments, or says it operates in a single segment.",
    ),
});

export const ExtractionSchema = z.object({
  currency_unit: z
    .string()
    .describe("The unit every figure is stated in, e.g. 'INR crore' or 'INR million'."),
  periods: z
    .array(PeriodSchema)
    .describe(
      "One entry per period per reporting basis, including comparatives. FY2025 consolidated and FY2025 standalone are two separate entries.",
    ),
  notes: z
    .string()
    .describe(
      "Anything the reviewer should know: restated figures, missing statements, ambiguity.",
    ),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractedPeriod = z.infer<typeof PeriodSchema>;

export const EXTRACTION_PROMPT = `You are reading an Indian company's financial report.

Extract the profit & loss, balance sheet, and cash flow figures for every period the document reports, including prior-period comparatives.

Finding the statements:
- In an annual report the three statements are far apart. The profit & loss usually appears first; the balance sheet and cash flow statement are often a hundred pages later, inside the audited financial statements. Look through the whole document before concluding a statement is absent.
- Indian reports head these sections in varying ways: "Balance Sheet", "Consolidated Balance Sheet", "Statement of Assets and Liabilities", "Statement of Cash Flows", "Cash Flow Statement". Treat all of them as the statement they are.
- Match statements to periods by their date. A balance sheet headed "as at 31 March 2024" belongs to FY2024. A cash flow statement "for the year ended 31 March 2024" belongs to FY2024. Put all three statements for the same year into the same period entry — do not create separate entries for them.

Two figures live in the notes rather than the statements:
- Shares outstanding. Look in the equity share capital note ("65,00,00,000 equity shares of Rs 2 each fully paid up") or the earnings-per-share note. Return a plain count of shares — 650000000, not 65 and not 6.5. If the report only gives a weighted average number of shares, use that and say so in "notes". Null if neither appears.
- Segments. Look for "Segment Information", "Operating Segments" or "Segment Reporting", usually a note near the end. Report each segment's revenue and, where disclosed, its segment result. Tag product or service segments as "business" and regions or countries as "geography" — a report often discloses both, and both should be returned. Return an empty array when the company states it operates in a single segment, and say that in "notes".

Rules:
- Report figures exactly as printed. Do not convert units, and do not calculate values that are not stated.
- If a line item is not disclosed, return null for it. Never guess, never infer, never derive one figure from others.
- Many quarterly filings contain only a profit & loss statement. In that case return nulls for the whole balance sheet and cash flow — that is expected, not a failure.
- If a statement is genuinely absent from the document, say so explicitly in "notes" and name which one. Do not leave the reviewer guessing whether you missed it or it was never there.
- Extract both consolidated and standalone figures when the report presents both. They are different sets of numbers, not alternatives: return FY2025 consolidated and FY2025 standalone as two separate period entries, each tagged with its own "basis". Do not merge them, and do not pick one over the other.
- Set "basis" to "unknown" only when the report genuinely does not say which it is.
- State the unit once in "currency_unit" (for example "INR crore"). Every figure must be in that unit, except EPS which stays per-share and shares outstanding which is a plain count.
- Segment revenue is in the currency unit like everything else. Do not make the segments add up to total revenue — report what is printed, unallocated items and all.
- Balance sheet figures are point-in-time; profit & loss and cash flow figures cover the period.
- Use "notes" to flag anything a reviewer should check: restated prior-year figures, unusual items, statements absent from the document, figures you were unsure about, or sections you could not read.

Accuracy matters far more than completeness. A null is always better than a wrong number.

Do not compute ratios, margins, or growth rates. Those are calculated separately from the figures you return.`;
