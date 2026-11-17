import type { AuthResult } from "@/lib/supabase/auth.server";
import {
  isCookOrder,
  type CookOrder,
} from "@/lib/cook-orders-client";

type DatabaseError = {
  message: string;
};

export type CookOrdersDependencies = {
  authenticate: () => Promise<AuthResult>;
  isApprovedCook: (
    userId: string,
  ) => Promise<{ approved: boolean; error: DatabaseError | null }>;
  listOrders: () => Promise<{
    data: unknown;
    error: DatabaseError | null;
  }>;
};

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function allowlistOrder(order: CookOrder): CookOrder {
  return {
    id: order.id,
    items: order.items.map((item) => ({
      menu_item_id: item.menu_item_id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
    })),
    status: order.status,
    payment_status: order.payment_status,
    hub: order.hub,
    pickup_date: order.pickup_date,
    pickup_time: order.pickup_time,
    meal_subtotal: order.meal_subtotal,
    created_at: order.created_at,
    collected_at: order.collected_at,
  };
}

export async function handleCookOrdersGet(
  dependencies: CookOrdersDependencies,
): Promise<Response> {
  let auth: AuthResult;

  try {
    auth = await dependencies.authenticate();
  } catch {
    return jsonError("Unable to verify authentication.", 500);
  }

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  if (auth.role !== "cook") {
    return jsonError("Forbidden.", 403);
  }

  let approvedCook: Awaited<
    ReturnType<CookOrdersDependencies["isApprovedCook"]>
  >;

  try {
    approvedCook = await dependencies.isApprovedCook(auth.user.id);
  } catch {
    return jsonError("Unable to verify cook permissions.", 500);
  }

  if (approvedCook.error) {
    console.error("Approved cook lookup failed:", approvedCook.error.message);
    return jsonError("Unable to verify cook permissions.", 500);
  }

  if (!approvedCook.approved) {
    return jsonError("An approved cook account is required.", 403);
  }

  let result: Awaited<
    ReturnType<CookOrdersDependencies["listOrders"]>
  >;

  try {
    result = await dependencies.listOrders();
  } catch {
    return jsonError("Unable to retrieve cook orders.", 500);
  }

  if (result.error) {
    console.error("Failed to fetch cook orders:", result.error.message);

    if (result.error.message === "Approved cook account required") {
      return jsonError("An approved cook account is required.", 403);
    }

    return jsonError("Unable to retrieve cook orders.", 500);
  }

  if (
    !Array.isArray(result.data) ||
    !result.data.every(isCookOrder)
  ) {
    console.error("Cook orders query returned an invalid result.");
    return jsonError("Unable to retrieve cook orders.", 500);
  }

  return Response.json({
    orders: result.data.map(allowlistOrder),
  });
}
