
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

  const { data, error } = await supabase.rpc("get_customer_order", {
    p_order_id: id,
  });

  if (error) {
    console.error("Failed to fetch order:", error.message);

    return NextResponse.json(
      { error: "Unable to retrieve order" },
      { status: 500 },
    );
  }

  const order = Array.isArray(data) ? data[0] : null;

  if (!order) {
    return NextResponse.json(
      { error: "Order not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ order });
}
