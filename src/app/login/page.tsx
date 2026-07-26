"use client";

import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

const initialState: AuthState = {};

const inputClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

export default function LoginPage() {
  const [signInState, signInAction, signingIn] = useActionState(
    signIn,
    initialState,
  );
  const [signUpState, signUpAction, signingUp] = useActionState(
    signUp,
    initialState,
  );

  const state =
    signInState.error || signInState.message ? signInState : signUpState;
  const pending = signingIn || signingUp;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <header className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Thakrar Associates
          </h1>
          <p className="stat-label">Portfolio &amp; Research</p>
        </header>

        <form className="mt-8 flex flex-col gap-5 rounded-lg border border-border bg-surface p-6">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete="current-password"
              className={inputClass}
            />
          </label>

          {state.error && (
            <p className="text-sm text-negative">{state.error}</p>
          )}
          {state.message && (
            <p className="text-sm text-positive">{state.message}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              formAction={signInAction}
              disabled={pending}
              className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {signingIn ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="submit"
              formAction={signUpAction}
              disabled={pending}
              className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent disabled:opacity-50"
            >
              {signingUp ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
