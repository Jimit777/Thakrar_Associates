"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function clearChat(formData: FormData) {
  const stockId = String(formData.get("stock_id") ?? "");
  if (!stockId) return;

  const supabase = await createClient();
  await supabase.from("chat_messages").delete().eq("stock_id", stockId);

  revalidatePath("/analyzer");
}
