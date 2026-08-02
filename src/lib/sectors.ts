import { z } from "zod";

/**
 * A fixed vocabulary, because free text does not group.
 *
 * "Banking", "Banks" and "Financial Services" typed on three different days
 * split one holding group into three, and the dashboard's whole point is
 * showing how much of your money depends on the same thing happening. Roughly
 * the divisions the Indian market itself uses.
 */
export const SECTORS = [
  "Banks",
  "NBFCs & financial services",
  "Insurance",
  "IT & software services",
  "Pharmaceuticals & healthcare",
  "Automobiles & components",
  "Metals & mining",
  "Oil, gas & energy",
  "Power & utilities",
  "Cement & construction materials",
  "Capital goods & engineering",
  "Chemicals & fertilisers",
  "Consumer goods & FMCG",
  "Retail & consumer services",
  "Textiles & apparel",
  "Real estate",
  "Infrastructure & logistics",
  "Telecom & media",
  "Agriculture & food processing",
  "Hospitality & travel",
  "Diversified & other",
] as const;

export type Sector = (typeof SECTORS)[number];

export const SectorAssignmentsSchema = z.object({
  assignments: z
    .array(
      z.object({
        symbol: z
          .string()
          .describe("The NSE ticker exactly as it was given to you."),
        sector: z
          .enum(SECTORS)
          .describe(
            "The one that best fits what the company actually earns most of its money from.",
          ),
      }),
    )
    .describe("One entry per company you were given. Do not skip any."),
});

export type SectorAssignments = z.infer<typeof SectorAssignmentsSchema>;

export const SECTOR_PROMPT = `You are classifying Indian listed companies into sectors.

You will be given a list of NSE tickers, some with company names. Return one sector for each, from the fixed list in the schema and nothing else.

Rules:
- Classify by where the company actually earns most of its revenue, not by what its name suggests or what it once did. A company called "XYZ Textiles" that now earns most of its money from real estate is real estate.
- A lender is "NBFCs & financial services" unless it holds a banking licence, in which case it is "Banks". Housing finance, gold loans, microfinance and supply-chain finance are all NBFCs.
- Use "Diversified & other" only when a company genuinely has no dominant business, or when you do not recognise the ticker. Do not guess a specific sector from the ticker alone.
- Return an entry for every ticker you were given, in the same order. Never drop one and never invent one that was not in the list.

You may search if you do not recognise a ticker, but most of these will be well-known names — do not search for the sake of it.`;
