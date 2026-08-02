import { createClient } from "@supabase/supabase-js";

/**
 * A client that bypasses Row Level Security, for the one job that has no user
 * session: the nightly cron.
 *
 * The service-role key is a master key to the database. It must never reach the
 * browser, so this file is only ever imported from route handlers that run on
 * the server, and every query made with it filters by user id explicitly —
 * the database is no longer doing that for us.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
