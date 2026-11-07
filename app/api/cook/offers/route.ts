
import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

import { readRequestBody } from "@/lib/request-body";
import { validateCookOffer } from "@/lib/validate-cook-offer";

const MAX_REQUEST_BODY_BYTES = 32_768;

type DatabaseError = {
  code?: string;
  message: string;
};

function getDatabaseErrorResponse(error: DatabaseError) {
  const message = error.message.toLowerCase();

  if (
    message.includes("authentication required")
  ) {
    return {
      status: 401,
      error: "Authentication required.",
    };
  }

  if (
    message.includes("approved cook account required")
  ) {
    return {
      status: 403,
      error: "An approved cook account is required.",
    };
  }

  if (message.includes("meal request not found")) {
    return {
      status: 404,
      error: "This meal request could not be found.",
    };
  }

  if (
    error.code === "23505" ||
    message.includes("already created an offer")
  ) {
    return {
      status: 409,
      error: "You have already submitted an offer for this request.",
    };
  }

  if (
    message.includes("no longer open") ||
    message.includes("deadline has passed") ||
    message.includes("no longer available")
  ) {
    return {
      status: 409,
      error: "This request or one of its selected menu items is no longer available.",
    };
  }

  if (
    message.includes("does not belong to your account")
  ) {
    return {
      status: 400,
      error: "One of the selected menu items is invalid.",
    };
  }

  if (
    message.includes("offer items") ||
    message.includes("offer must contain") ||
    message.includes("offer message") ||
    message.includes("item quantity") ||
    message.includes("unit price") ||
    message.includes("meal name") ||
    message.includes("meal description") ||
    message.includes("custom meals") ||
    message.includes("offer total") ||
    message.includes("menu item")
  ) {
    return {
      status: 400,
      error: "Some offer details are invalid. Please review your offer.",
    };
  }

  return {
    status: 500,
    error: "Unable to submit your offer. Please try again.",
  };
}

export async function POST(request: Request) {
  // 1. Authenticate the cook.
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

  // 2. Reject invalid or oversized declared request bodies.
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

  // 3. Read the request while enforcing the actual byte limit.
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

  // 4. Parse the JSON body.
  let body: unknown;

  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  // 5. Validate and normalize the offer.
  const validation = validateCookOffer(body);

  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 },
    );
  }

  // 6. Verify that the cook is still approved.
  const supabase = await createServerSupabaseClient();

  const { data: cookProfile, error: profileError } = await supabase
    .from("cook_profiles")
    .select("status")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Cook approval lookup failed:", {
      code: profileError.code,
      message: profileError.message,
    });

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

  // 7. Create and submit the offer in one database operation.
  // The database function handles ownership, request status,
  // deadline checks, menu-item verification and total calculation.
  const { data: offer, error: submissionError } = await supabase.rpc(
    "create_and_submit_cook_offer",
    {
      p_request_id: validation.value.request_id,
      p_message: validation.value.message,
      p_items: validation.value.items,
    },
  );

  if (submissionError) {
    console.error("Cook offer submission failed:", {
      code: submissionError.code,
      message: submissionError.message,
    });

    const response = getDatabaseErrorResponse({
      code: submissionError.code,
      message: submissionError.message,
    });

    return NextResponse.json(
      { error: response.error },
      { status: response.status },
    );
  }

  if (!offer) {
    console.error("Cook offer submission returned no result.");

    return NextResponse.json(
      { error: "Unable to confirm offer submission." },
      { status: 500 },
    );
  }

  // 8. Return the database-confirmed submission result.
  return NextResponse.json(
    { offer },
    { status: 201 },
  );
}
