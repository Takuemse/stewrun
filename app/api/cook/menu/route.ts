
import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

export async function GET() {
  // 1. Verify that the caller has an authenticated session.
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  // 2. Only cooks can access this endpoint.
  if (auth.role !== "cook") {
    return NextResponse.json(
      { error: "Cook access required." },
      { status: 403 },
    );
  }

  const supabase = await createServerSupabaseClient();

  // 3. Verify that the cook has been approved.
  const { data: cookProfile, error: profileError } = await supabase
    .from("cook_profiles")
    .select("status")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Cook profile lookup failed:", profileError);

    return NextResponse.json(
      { error: "Unable to verify cook approval." },
      { status: 500 },
    );
  }

  if (!cookProfile || cookProfile.status !== "approved") {
    return NextResponse.json(
      { error: "An approved cook account is required." },
      { status: 403 },
    );
  }

  // 4. Retrieve only this cook's available menu items.
  const { data: menu, error: menuError } = await supabase
    .from("menu_items")
    .select("id, name, description, price")
    .eq("cook_id", auth.user.id)
    .eq("available", true)
    .order("name", { ascending: true });

  if (menuError) {
    console.error("Cook menu lookup failed:", menuError);

    return NextResponse.json(
      { error: "Unable to retrieve your menu items." },
      { status: 500 },
    );
  }

  // 5. Return a predictable response for the offer composer.
  return NextResponse.json(
    { menu: menu ?? [] },
    { status: 200 },
  );
}
