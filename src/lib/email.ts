/**
 * Sending mail, through Resend's REST API directly rather than its SDK — it is
 * one POST, and a dependency for that is a dependency to keep updated.
 *
 * Everything is optional: with no key configured, `configured` comes back false
 * and callers carry on. The digest still gets built and is still waiting in the
 * app; only the email is skipped.
 */

export type SendResult =
  | { ok: true }
  | { ok: false; configured: boolean; error: string };

const DEFAULT_FROM = "Thakrar Associates <onboarding@resend.dev>";

export async function sendEmail(message: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      configured: false,
      error: "RESEND_API_KEY is not set, so email is turned off.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.DIGEST_FROM || DEFAULT_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        configured: true,
        error: `Resend returned ${response.status}. ${detail.slice(0, 300)}`,
      };
    }

    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      configured: true,
      error: cause instanceof Error ? cause.message : "Sending failed.",
    };
  }
}
