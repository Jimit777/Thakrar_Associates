import { z } from "zod";

/**
 * The model's only job here is naming the competitors.
 *
 * Asking it for their figures too meant ten searches, a slow wait and a table
 * with holes in it — a page had to be found and read for every company, and
 * half the metrics an industry uses aren't on the page you land on. Worse, the
 * figures that did come back covered whatever period the page happened to show.
 *
 * Naming peers is the one part that genuinely needs a model: it is a judgement
 * about what a business actually competes with. Everything measurable is then
 * taken from the price feed, where it costs nothing, arrives in one request per
 * company, and is exact.
 */

const PeerSchema = z.object({
  name: z.string().describe("The company's name."),
  symbol: z
    .string()
    .describe(
      "Its NSE ticker in capitals, as it appears on the exchange — RELIANCE, HDFCBANK, BAJFINANCE. This is looked up directly, so accuracy matters more than completeness: leave it empty rather than guess.",
    ),
  why: z
    .string()
    .describe(
      "What makes it a genuine comparison, under 15 words. Name the overlap — same product, same customers, same regulator.",
    ),
});

export const PeersSchema = z.object({
  basis: z
    .string()
    .describe(
      "One sentence on how you have defined this company's competitive set, and what you have deliberately left out of it.",
    ),
  peers: z
    .array(PeerSchema)
    .describe("Four to six listed Indian competitors, closest comparison first."),
});

export type Peers = z.infer<typeof PeersSchema>;

export const PEERS_PROMPT = `Name the listed Indian companies that one company genuinely competes with.

That is the whole task. You are not being asked for anyone's financial figures — the app takes those from the price feed itself. Spend your effort on getting the competitive set and the tickers right.

Choosing peers:
- Same business, not merely the same index or the same sector label. A supply-chain-finance NBFC competes with other supply-chain and channel financiers, not with every NBFC in the country. A specialty chemicals maker competes with companies selling into the same end markets, not with all of chemicals.
- Listed in India, so the ticker resolves and the prices are comparable.
- Range of sizes is fine and often useful, but a company ten times the size in a different segment is not a peer.
- Four to six, closest comparison first. Fewer if the company genuinely has few listed competitors — say so in the basis rather than padding the list.

Tickers are the part that must be right:
- Give the NSE ticker exactly as the exchange lists it, in capitals. It is looked up directly against the price feed, so a wrong one silently drops that peer from the table.
- If you are not confident of a ticker, return an empty string rather than a guess. A named peer without a ticker is more useful than a wrong ticker.

In the basis, say how you defined the competitive set and what you left out — a reader who disagrees with the peers should be able to see why you chose them.

Two or three searches is plenty. No investment advice: do not rank the companies or say which is the better business.`;
