"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SettingsResult = { error?: string; enabled?: boolean };

/**
 * Turns the scheduled digest email on or off.
 *
 * Only the scheduled send: pressing "Email it to me" on the news page is an
 * explicit request each time, and a switch meant for the automatic one has no
 * business blocking it.
 */
export async function setDigestEmail(
  enabled: boolean,
): Promise<SettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      digest_email_enabled: enabled,
    },
    { onConflict: "user_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/");
  return { enabled };
}
