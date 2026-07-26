"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

/**
 * Sign in and sign up share one action so the page only ever has a single
 * result to display — otherwise a stale error from one can mask the other.
 * Which one runs is decided by the button the user clicked.
 */
export async function authenticate(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const intent = String(formData.get("intent") ?? "signin");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();

  if (intent === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) return { error: error.message };

    // No session means Supabase is waiting for the email to be confirmed.
    if (!data.session) {
      return {
        message:
          "Account created, but it needs confirming before you can sign in. Either click the link Supabase emailed you, or turn off Authentication → Sign In / Providers → Email → Confirm email in your Supabase project.",
      };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Supabase deliberately returns the same message for a wrong password
      // and an unconfirmed account, so point at both.
      if (error.message === "Invalid login credentials") {
        return {
          error:
            "Wrong email or password — or the account exists but hasn't been confirmed yet.",
        };
      }
      return { error: error.message };
    }
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
