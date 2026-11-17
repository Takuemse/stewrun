import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";
import { readRequestBody } from "@/lib/request-body";
import { validateOrderRating } from "@/lib/validate-order-rating";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 2_048;

async function authenticateCustomer() {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return {
      response: NextResponse.json({ error: auth.error }, { status: auth.status }),
    };
  }
  if (auth.role !== "customer") {
    return {
      response: NextResponse.json(
        { error: "Customer access required." },
        { status: 403 },
      ),
    };
  }
  return { auth, supabase: await createServerSupabaseClient() };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "A valid order ID is required." },
      { status: 400 },
    );
  }

  const access = await authenticateCustomer();
  if ("response" in access) return access.response;

  const { data, error } = await access.supabase
    .from("ratings")
    .select("stars, comment")
    .eq("order_id", id)
    .eq("customer_id", access.auth.user.id)
    .maybeSingle();

  if (error) {
    console.error("Order rating lookup failed:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to load this order rating." },
      { status: 500 },
    );
  }

  return NextResponse.json({ rating: data ?? null });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "A valid order ID is required." },
      { status: 400 },
    );
  }

  const access = await authenticateCustomer();
  if ("response" in access) return access.response;

  const body = await readRequestBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      {
        error:
          body.reason === "too_large"
            ? "Request body is too large."
            : "Could not read request body.",
      },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(body.text) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const validation = validateOrderRating(value);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data, error } = await access.supabase
    .from("ratings")
    .insert({
      order_id: id,
      customer_id: access.auth.user.id,
      stars: validation.value.stars,
      comment: validation.value.comment,
    })
    .select("stars, comment")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You have already rated this order." },
        { status: 409 },
      );
    }
    if (error.code === "P0001" || error.code === "42501") {
      return NextResponse.json(
        { error: "Only collected, cash-paid orders can be rated." },
        { status: 409 },
      );
    }
    console.error("Order rating insert failed:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to save this rating." },
      { status: 500 },
    );
  }

  return NextResponse.json({ rating: data }, { status: 201 });
}
