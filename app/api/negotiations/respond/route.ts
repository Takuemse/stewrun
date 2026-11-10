import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

import { readRequestBody } from "@/lib/request-body";
import { validateNegotiationResponse } from "@/lib/validate-negotiation-response";

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

  if (message.includes("decision must be accepted or rejected")) {
    return {
      status: 400,
      error: "Invalid negotiation decision.",
    };
  }

  if (message.includes("approved cook account required")) {
    return {
      status: 403,
      error: "An approved cook account is required.",
    };
  }

  if (
    message.includes("negotiation not found for this cook") ||
    message.includes("negotiation not found")
  ) {
    return {
      status: 404,
      error: "This negotiation could not be found.",
    };
  }

  if (
    message.includes("this meal request is no longer open") ||
    message.includes("this cook offer is no longer available")
  ) {
    return {
      status: 409,
      error: "This negotiation is no longer available.",
    };
  }

  if (message.includes("this negotiation has already been answered")) {
    return {
      status: 409,
      error: "This negotiation has already been answered.",
    };
  }

  if (message.includes("negotiation customer does not own this request")) {
    return {
      status: 409,
      error: "This negotiation can no longer be processed.",
    };
  }

  if (message.includes("negotiated amount is no longer valid")) {
    return {
      status: 409,
      error: "This negotiated amount is no longer valid.",
    };
  }

  if (message.includes("negotiation response could not be saved")) {
    return {
      status: 409,
      error: "This negotiation could not be updated. Please refresh and try again.",
    };
  }

  return {
    status: 500,
    error: "Unable to respond to this negotiation.",
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

  // 5. Validate the negotiation response.
  const validation = validateNegotiationResponse(body);

  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 },
    );
  }

  // 6. Respond through the authenticated database client.
  // The RPC enforces cook approval, ownership, negotiation status,
  // request status and the validity of the negotiated amount.
  const supabase = await createServerSupabaseClient();

  const { data: response, error: submissionError } =
    await supabase.rpc("respond_to_negotiation", {
      p_negotiation_id: validation.value.negotiation_id,
      p_decision: validation.value.decision,
    });

  if (submissionError) {
    console.error("Cook negotiation response failed:", {
      code: submissionError.code,
      message: submissionError.message,
    });

    const errorResponse = getDatabaseErrorResponse({
      code: submissionError.code,
      message: submissionError.message,
    });

    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.status },
    );
  }

  // 7. Confirm that the RPC returned exactly one database result.
  if (!Array.isArray(response) || response.length !== 1) {
    console.error(
      "Cook negotiation response returned an unexpected result.",
    );

    return NextResponse.json(
      { error: "Unable to confirm negotiation response." },
      { status: 500 },
    );
  }

  // 8. Return the database-confirmed negotiation response.
  return NextResponse.json(
    { negotiation: response[0] },
    { status: 200 },
  );
}
