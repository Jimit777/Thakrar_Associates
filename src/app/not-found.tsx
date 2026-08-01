import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="stat-label">404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
          Page not found
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          The page you were after doesn&apos;t exist. If you followed a link to a
          stock, it may have been removed.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
