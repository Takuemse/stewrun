import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "A valid meal request ID is required." },
      { status: 400 },
    );
  }

  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (auth.role !== "customer") {
    return NextResponse.json(
      { error: "Customer access required." },
      { status: 403 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "cancel_customer_meal_request",
    { p_request_id: id },
  );

  if (error) {
    if (error.message.toLowerCase().includes("not found")) {
      return NextResponse.json(
        { error: "This meal request could not be found." },
        { status: 404 },
      );
    }
    console.error("Meal request cancellation failed:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to cancel this meal request." },
      { status: 500 },
    );
  }

  if (data === "not_cancellable") {
    return NextResponse.json(
      {
        error:
          "This request can no longer be cancelled because an offer has been selected or an order is confirmed.",
      },
      { status: 409 },
    );
  }

  if (data !== "cancelled" && data !== "already_cancelled") {
    console.error("Meal request cancellation returned an invalid result.");
    return NextResponse.json(
      { error: "Unable to confirm request cancellation." },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: "cancelled" });
}
