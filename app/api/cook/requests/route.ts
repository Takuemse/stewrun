
import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

export async function GET() {
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  if (auth.role !== "cook") {
    return NextResponse.json(
      { error: "Cook access required." },
      { status: 403 },
    );
  }

  const supabase = await createServerSupabaseClient();

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

  const { data: requests, error: requestsError } = await supabase
    .from("meal_requests")
    .select(
      `
        id,
        items,
        budget,
        hub,
        pickup_date,
        pickup_time,
        notes,
        created_at,
        offers_close_at
      `,
    )
    .eq("status", "open")
    .order("pickup_date", { ascending: true })
    .order("pickup_time", { ascending: true });

  if (requestsError) {
    console.error("Meal request lookup failed:", requestsError);

    return NextResponse.json(
      { error: "Unable to retrieve meal requests." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { requests: requests ?? [] },
    { status: 200 },
  );
}
