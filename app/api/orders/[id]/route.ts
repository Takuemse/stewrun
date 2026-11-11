
import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  createServerSupabaseClient,
} from "@/lib/supabase/auth.server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
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

  const { id } = await params;

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
        "id, total, status, payment_status, hub, pickup_date, pickup_time, reservation_expires_at",
    )
    .eq("id", id)
    .eq("customer_id", auth.user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch order:", error.message);

    return NextResponse.json(
      { error: "Unable to retrieve order" },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Order not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ order: data });
}
