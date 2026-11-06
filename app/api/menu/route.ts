import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/auth.server";

export async function GET() {
  // Menu retrieval is public per existing RLS design (menu read using true).
  // We still create a Supabase client to benefit from RLS scoping, but
  // the policy allows any caller (authenticated or not) to read menu items.

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, description, price")
    .eq("available", true);

  if (error) {
    console.error("Supabase menu error:", error);
    return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 });
  }

  return NextResponse.json({ menu: data || [] });
}