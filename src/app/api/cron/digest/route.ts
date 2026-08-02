import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDigest } from "@/lib/digest";
import { renderDigestEmail } from "@/lib/digest-email";
import { sendEmail } from "@/lib/email";
import type { NewsDigest } from "@/lib/news-schema";

/**
 * Sends a freshly built digest to the address the account was created with.
 *
 * No recipient is configured anywhere: the signed-up address is the one the
 * user already proved they control, and asking for a second one would only be
 * another thing to get wrong.
 */
async function emailDigest(supabase: SupabaseClient, userId: string) {
  const { data: account } = await supabase.auth.admin.getUserById(userId);
  const to = account?.user?.email;

  if (!to) return { sent: false, error: "No email address on the account." };

  const { data: row } = await supabase
    .from("news_digests")
    .select("content")
    .eq("user_id", userId)
    .maybeSingle<{ content: NewsDigest }>();

  if (!row) return { sent: false, error: "No digest to send." };

  const date = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  const result = await sendEmail({
    to,
    subject: `Portfolio digest · ${date}`,
    html: renderDigestEmail(row.content, date),
  });

  if (result.ok) return { sent: true };

  // Email being switched off is a configuration choice, not a failure.
  return {
    sent: false,
    ...(result.configured ? { error: result.error } : {}),
  };
}

// A digest is several web searches and a Sonnet call per user.
export const maxDuration = 300;

/**
 * Rebuilds every user's news digest once a day, so it is already waiting rather
 * than being built while you look at a spinner.
 *
 * Vercel calls this on a schedule with a bearer token it generates from
 * CRON_SECRET. Without that token the route does nothing — it is a public URL
 * that spends money, and an open one would be a way to run up the bill.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set, so scheduled runs are disabled." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set." },
      { status: 503 },
    );
  }

  // Only users who actually hold something — a digest of an empty portfolio is
  // a wasted call.
  const { data: holders, error } = await supabase
    .from("holdings")
    .select("user_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = [
    ...new Set((holders ?? []).map((row) => row.user_id as string)),
  ];

  const results: {
    userId: string;
    ok: boolean;
    emailed?: boolean;
    error?: string;
  }[] = [];

  // Sequential on purpose: these are long, search-backed calls, and running
  // them all at once is a good way to hit a rate limit and lose the lot.
  for (const userId of userIds) {
    const result = await buildDigest(supabase, userId);

    if (!result.ok) {
      results.push({ userId, ok: false, error: result.error });
      continue;
    }

    // Emailing is a separate concern from building: a mail failure must not
    // lose a digest that was successfully assembled and saved.
    const emailed = await emailDigest(supabase, userId);

    results.push({
      userId,
      ok: true,
      emailed: emailed.sent,
      ...(emailed.error ? { error: emailed.error } : {}),
    });
  }

  return NextResponse.json({
    ran: userIds.length,
    succeeded: results.filter((entry) => entry.ok).length,
    results,
  });
}
