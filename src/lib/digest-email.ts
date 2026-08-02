import type { NewsDigest, NewsItem } from "@/lib/news-schema";

/**
 * The digest as an email.
 *
 * Tables and inline styles throughout, because mail clients strip stylesheets
 * and most still lay out with tables. No web fonts, no images, no external
 * anything — an email that needs to load something to be readable often isn't.
 */

/** Everything here passed through a model, so nothing goes in unescaped. */
function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Only ever link somewhere a browser will actually go. */
function safeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? esc(url) : null;
}

const INK = "#111827";
const MUTED = "#6b7280";
const ACCENT = "#a9502f";
const BORDER = "#e5e7eb";

function renderItem(item: NewsItem) {
  const url = safeUrl(item.url);
  const affected =
    item.affected.length > 0 ? ` · ${esc(item.affected.join(", "))}` : "";

  return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid ${BORDER};">
        <div style="font-size:15px;font-weight:600;color:${INK};line-height:1.4;">
          ${esc(item.headline)}
        </div>
        <div style="margin-top:6px;font-size:14px;color:${MUTED};line-height:1.6;">
          ${esc(item.what_happened)}
        </div>
        <div style="margin-top:6px;padding-left:10px;border-left:2px solid ${BORDER};font-size:14px;color:${INK};line-height:1.6;">
          ${esc(item.why_it_matters)}
        </div>
        <div style="margin-top:8px;font-size:12px;color:${MUTED};">
          ${
            url
              ? `<a href="${url}" style="color:${ACCENT};text-decoration:underline;">${esc(item.source_label)}</a>`
              : esc(item.source_label)
          }
          · ${esc(item.when)}${affected}
        </div>
      </td>
    </tr>`;
}

export function renderDigestEmail(digest: NewsDigest, date: string) {
  const sectors = digest.sectors
    .map(
      (sector) => `
      <tr>
        <td style="padding-top:26px;">
          <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">
            ${esc(sector.sector)}${sector.holdings.length > 0 ? ` · ${esc(sector.holdings.join(", "))}` : ""}
          </div>
          <div style="margin-top:6px;font-size:14px;color:${INK};line-height:1.6;">
            ${esc(sector.sector_read)}
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${sector.items.map(renderItem).join("")}
          </table>
        </td>
      </tr>`,
    )
    .join("");

  const macro =
    digest.macro.length === 0
      ? ""
      : `
      <tr>
        <td style="padding-top:26px;">
          <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">
            Market-wide
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${digest.macro.map(renderItem).join("")}
          </table>
        </td>
      </tr>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:600px;background:#ffffff;border:1px solid ${BORDER};border-radius:10px;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td>
                <div style="font-size:18px;font-weight:600;color:${INK};">
                  Thakrar Associates
                </div>
                <div style="margin-top:2px;font-size:12px;color:${MUTED};">
                  Portfolio digest · ${esc(date)}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding-top:18px;">
                <div style="padding:14px;background:#f9fafb;border-radius:8px;font-size:15px;color:${INK};line-height:1.6;">
                  ${esc(digest.takeaway)}
                </div>
              </td>
            </tr>

            ${sectors}
            ${macro}

            ${
              digest.coverage_note
                ? `<tr><td style="padding-top:22px;font-size:12px;color:${MUTED};line-height:1.6;">
                     ${esc(digest.coverage_note)}
                   </td></tr>`
                : ""
            }

            <tr>
              <td style="padding-top:26px;border-top:1px solid ${BORDER};margin-top:20px;font-size:12px;color:${MUTED};line-height:1.6;">
                Assembled from web searches and not checked by anyone. Follow a
                source link before acting on something. Not investment advice.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
