
import type { AuthResult } from "@/lib/supabase/auth.server";

type RpcResult = {
  data: string | null;
  error: {
    message: string;
  } | null;
};

export type CookOrderTransitionDependencies = {
  authenticate: () => Promise<AuthResult>;
  markOrderReady: (orderId: string) => Promise<RpcResult>;
  confirmOrderCollection: (
    orderId: string,
    pickupCode: string,
  ) => Promise<RpcResult>;
};

type TransitionType = "ready" | "collect";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function mapRpcError(message: string): Response {
  switch (message) {
    case "Authentication required":
      return jsonError("Authentication required.", 401);

    case "Approved cook account required":
      return jsonError("An approved cook account is required.", 403);

    case "Assigned order not found":
    case "Associated meal request not found":
      return jsonError("Order not found.", 404);

    case "Pickup code is required":
      return jsonError("Pickup code is required.", 400);

    case "Invalid pickup code":
      return jsonError("The pickup code is incorrect.", 400);

    case "Order payment has not been confirmed":
      return jsonError("This order has not been paid.", 409);

    case "Order is not eligible to be marked ready":
    case "Order is not ready for collection":
    case "Order pickup code is missing":
    case "Order could not be marked ready":
    case "Order collection could not be confirmed":
      return jsonError(
        "The order cannot be updated in its current state.",
        409,
      );

    default:
      return jsonError("Unable to update the order.", 500);
  }
}

async function handleRpcResult(
  result: RpcResult,
  expectedResults: readonly string[],
  successMessage: string,
): Promise<Response> {
  if (result.error) {
    return mapRpcError(result.error.message);
  }

  if (
    typeof result.data !== "string" ||
    !expectedResults.includes(result.data)
  ) {
    return jsonError("Unable to update the order.", 500);
  }

  return Response.json({
    success: true,
    result: result.data,
    message: successMessage,
  });
}

export async function handleCookOrderTransition(
  request: Request,
  orderId: string,
  transition: TransitionType,
  dependencies: CookOrderTransitionDependencies,
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

  if (!UUID_PATTERN.test(orderId)) {
    return jsonError("A valid order ID is required.", 400);
  }

  if (transition === "ready") {
    if (request.method !== "POST") {
      return jsonError("Method not allowed.", 405);
    }

    try {
      const result = await dependencies.markOrderReady(orderId);

      return handleRpcResult(
        result,
        ["order_marked_ready", "already_ready"],
        result.data === "already_ready"
          ? "Order is already marked ready."
          : "Order marked ready.",
      );
    } catch {
      return jsonError("Unable to update the order.", 500);
    }
  }

  if (request.method !== "POST") {
    return jsonError("Method not allowed.", 405);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("A valid JSON body is required.", 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return jsonError("A valid pickup code is required.", 400);
  }

  const pickupCode = (body as Record<string, unknown>).pickupCode;

  if (
    typeof pickupCode !== "string" ||
    pickupCode.trim().length === 0 ||
    pickupCode.length > 64
  ) {
    return jsonError("A valid pickup code is required.", 400);
  }

  try {
    const result = await dependencies.confirmOrderCollection(
      orderId,
      pickupCode.trim(),
    );

    return handleRpcResult(
      result,
      ["order_collected", "already_collected"],
      result.data === "already_collected"
        ? "Order has already been collected."
        : "Order collection confirmed.",
    );
  } catch {
    return jsonError("Unable to update the order.", 500);
  }
}
