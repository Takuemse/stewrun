import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

import { readRequestBody } from "@/lib/request-body";
import { validateCustomerCounteroffer } from "@/lib/validate-customer-counteroffer";

const MAX_REQUEST_BODY_BYTES = 8_192;

type DatabaseError = {
  code?: string;
  message: string;
};

function getDatabaseErrorResponse(error: DatabaseError) {
  const message = error.message.toLowerCase();

  if (message.includes("authentication required")) {
    return {
      status: 401,
      error: "Authentication required.",
    };
  }

  if (message.includes("customer account required")) {
    return {
      status: 403,
      error: "Customer access required.",
    };
  }

  if (
    message.includes("cook offer not found") ||
    message.includes("meal request not found")
  ) {
    return {
      status: 404,
      error: "The selected offer or meal request could not be found.",
    };
  }

  if (message.includes("another customer's request")) {
    return {
      status: 403,
      error: "You cannot negotiate another customer's request.",
    };
  }

  if (
    message.includes("invalid counteroffer amount") ||
    message.includes("counteroffer message cannot exceed") ||
    message.includes("counteroffer must be lower")
  ) {
    return {
      status: 400,
      error: "Your counteroffer details are invalid.",
    };
  }

  if (
    error.code === "23505" ||
    message.includes("already used its counteroffer")
  ) {
    return {
      status: 409,
      error: "You have already used your counteroffer for this request.",
    };
  }

  if (
    message.includes("no longer open") ||
    message.includes("no longer available") ||
    message.includes("not currently approved")
  ) {
    return {
      status: 409,
      error: "This offer or meal request is no longer available for negotiation.",
    };
  }

  return {
    status: 500,
    error: "Unable to submit your counteroffer.",
  };
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

  // 5. Validate and normalize the counteroffer.
  const validation = validateCustomerCounteroffer(body);

  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 },
    );
  }

  // 6. Submit the counteroffer through the authenticated database client.
  // The RPC enforces ownership, offer status, cook approval,
  // the original offer price and the one-counteroffer-per-request rule.
  const supabase = await createServerSupabaseClient();

  const { data: negotiations, error: submissionError } =
    await supabase.rpc("create_customer_counteroffer", {
      p_offer_id: validation.value.offer_id,
      p_proposed_total: validation.value.proposed_total,
      p_message: validation.value.message,
    });

  if (submissionError) {
    console.error("Customer counteroffer submission failed:", {
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

  // 7. Confirm that the RPC returned exactly one database result.
  if (!Array.isArray(negotiations) || negotiations.length !== 1) {
    console.error("Customer counteroffer submission returned an unexpected result.");

    return NextResponse.json(
      { error: "Unable to confirm counteroffer submission." },
      { status: 500 },
    );
  }

  // 8. Return the database-confirmed negotiation.
  return NextResponse.json(
    { negotiation: negotiations[0] },
    { status: 201 },
  );
}
