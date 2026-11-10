import { NextResponse } from "next/server";

import {
  getAuthenticatedUser,
  createServerSupabaseClient,
} from "@/lib/supabase/auth.server";

import { readRequestBody } from "@/lib/request-body";
import { validateOrderReservation } from "@/lib/validate-order-reservation";
import { getReservationErrorResponse } from "@/lib/order-reservation-error";

const MAX_REQUEST_BODY_BYTES = 4_096;
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

export async function POST(request: Request) {
  // 1. Authenticate the customer.
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  if (auth.role !== "customer") {
    return NextResponse.json(
      { error: "Customer access required." },
      { status: 403 },
    );
  }

  // 2. Check the declared request body size.
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    const declaredBodyBytes = Number(contentLength);

    if (
      !Number.isSafeInteger(declaredBodyBytes) ||
      declaredBodyBytes < 0
    ) {
      return NextResponse.json(
        { error: "Invalid request body size." },
        { status: 400 },
      );
    }

    if (declaredBodyBytes > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 },
      );
    }
  }

  // 3. Read the body with an actual byte limit.
  const bodyResult = await readRequestBody(
    request,
    MAX_REQUEST_BODY_BYTES,
  );

  if (!bodyResult.ok) {
    if (bodyResult.reason === "too_large") {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 },
      );
    }

    return NextResponse.json(
      { error: "Could not read request body." },
      { status: 400 },
    );
  }

  // 4. Parse JSON.
  let body: unknown;

  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  // 5. Validate the offer ID.
  const validation = validateOrderReservation(body);

  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 },
    );
  }

  // 6. Create the reservation using the authenticated customer session.
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc(
    "create_order_reservation",
    {
      p_offer_id: validation.value.offer_id,
    },
  );

  if (error) {
    console.error("Order reservation failed:", {
      code: error.code,
      message: error.message,
    });

    const response = getReservationErrorResponse({
      code: error.code,
      message: error.message,
    });

    return NextResponse.json(
      { error: response.error },
      { status: response.status },
    );
  }

  // 7. Verify the database returned a usable reservation.
  const reservation = Array.isArray(data) ? data[0] : data;

  if (
    !reservation ||
    typeof reservation !== "object" ||
    !("order_id" in reservation) ||
    !("reservation_expires_at" in reservation) ||
    !("amount_due" in reservation)
  ) {
    console.error("Order reservation returned an invalid result.");

    return NextResponse.json(
      { error: "Unable to confirm the reservation." },
      { status: 500 },
    );
  }

  const result = reservation as {
    order_id: unknown;
    reservation_expires_at: unknown;
    amount_due: unknown;
  };

  const amountDue = Number(result.amount_due);

  if (
    typeof result.order_id !== "string" ||
    typeof result.reservation_expires_at !== "string" ||
    !Number.isFinite(Date.parse(result.reservation_expires_at)) ||
    !Number.isFinite(amountDue) ||
    amountDue <= 0
  ) {
    console.error("Order reservation returned invalid reservation fields.");

    return NextResponse.json(
      { error: "Unable to confirm the reservation." },
      { status: 500 },
    );
  }

  // 8. Return only the database-confirmed reservation details.
  return NextResponse.json(
    {
      reservation: {
        order_id: result.order_id,
        reservation_expires_at: result.reservation_expires_at,
        amount_due: amountDue,
      },
    },
    { status: 200 },
  );
}
