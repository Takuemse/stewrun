import { ecoCashPaymentsUnavailableResponse } from "@/lib/eco-cash-payment-availability";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return Response.json(
      { error: "A valid order ID is required." },
      { status: 400 },
    );
  }

  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (auth.role !== "customer") {
    return Response.json(
      { error: "Customer access required." },
      { status: 403 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: orderData, error } = await supabase.rpc("get_customer_order", {
    p_order_id: id,
  });

  if (error) {
    console.error("Cash payment check failed:", {
      code: error.code,
      message: error.message,
    });
    return Response.json(
      { error: "Unable to verify this order." },
      { status: 500 },
    );
  }

  const order = Array.isArray(orderData) ? orderData[0] : null;
  if (!order) {
    return Response.json({ error: "Order not found." }, { status: 404 });
  }

  if (
    typeof order === "object" &&
    order !== null &&
    "cash_payment_status" in order &&
    order.cash_payment_status === "due"
  ) {
    return Response.json(
      {
        error:
          "This order is paid directly to the cook in cash when you collect it.",
      },
      { status: 409 },
    );
  }

  return ecoCashPaymentsUnavailableResponse();
}
