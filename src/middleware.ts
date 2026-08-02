import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every page request except static assets, image files, and the
     * cron routes.
     *
     * Cron is excluded because a scheduled run has no session — Vercel calls it
     * with a bearer token and nothing else, so the session check here would
     * redirect it to /login and the job would silently never run. Those routes
     * do their own authorisation against CRON_SECRET instead.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
