
import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  createServerSupabaseClient,
} from "@/lib/supabase/auth.server";

export async function GET() {
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  if (auth.role !== "customer") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch customer orders:", error.message);

    return NextResponse.json(
      { error: "Unable to retrieve orders" },
      { status: 500 },
    );
  }

  return NextResponse.json({ orders: data ?? [] });
}
