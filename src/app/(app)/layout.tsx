import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { CommandPalette } from "@/components/command-palette";

/**
 * Layout for every signed-in page: checks the session once, then renders the
 * shared navigation bar around whatever page is being viewed.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetched once for the whole signed-in area so ⌘K can reach any stock from
  // any page. Symbols and names only — a few hundred bytes.
  const { data: stocks } = await supabase
    .from("stocks")
    .select("symbol, name")
    .order("symbol");

  const jumpTargets = (stocks ?? []).map((stock) => ({
    label: stock.symbol as string,
    hint: (stock.name as string | null) ?? "Stock",
    href: `/analyzer/${stock.symbol}`,
  }));

  return (
    <>
      <CommandPalette stocks={jumpTargets} />
      <SiteHeader email={user.email ?? ""} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </div>
    </>
  );
}
