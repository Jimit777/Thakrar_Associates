"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/news", label: "News" },
  { href: "/analyzer", label: "Analyzer" },
];

/**
 * On a phone the title, four links and the sign-out button do not fit on one
 * line, so the bar splits: title and account on top, navigation on its own
 * scrollable row beneath. From `sm` up it collapses back into a single row.
 */
export function SiteHeader({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:gap-8 sm:py-3">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight sm:text-base"
            >
              Thakrar Associates
            </Link>

            {/* On mobile the account controls ride alongside the title. */}
            <div className="flex items-center gap-3 sm:hidden">
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>

          <nav className="scroll-x -mx-4 flex items-center gap-1 px-4 sm:mx-0 sm:px-0">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-md px-3 py-2 text-sm transition-colors sm:py-1.5 ${
                    active
                      ? "bg-surface-sunken font-medium text-accent"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto hidden items-center gap-4 sm:flex">
            <span className="text-xs text-muted">{email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
