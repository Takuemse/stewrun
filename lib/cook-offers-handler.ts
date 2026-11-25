
import type { AuthResult } from "@/lib/supabase/auth.server";
import { readRequestBody } from "@/lib/request-body";
import { validateCookOffer } from "@/lib/validate-cook-offer";
import { validateStandardCookOffer } from "@/lib/validate-standard-cook-offer";

const MAX_REQUEST_BODY_BYTES = 32_768;

type DatabaseError = {
  code?: string;
  message: string;
};

type CookProfile = {
  status: string;
  is_available?: boolean;
};

type SubmittedOffer = {
  id: string;
  request_id: string;
  total_price: number;
  submitted_at: string;
};

type OfferItem = {
  offer_id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type MealRequest = {
  id: string;
  items: unknown;
  hub: string;
  pickup_date: string;
  pickup_time: string;
};

type OfferSubmission = {
  p_request_id: string;
  p_message: string | null;
  p_items: unknown[];
};

export type CookOffersDependencies = {
  authenticate: () => Promise<AuthResult>;

  getCookProfile: (
    userId: string,
  ) => Promise<{
    data: CookProfile | null;
    error: DatabaseError | null;
  }>;

  listOffers: (
    userId: string,
  ) => Promise<{
    data: SubmittedOffer[] | null;
    error: DatabaseError | null;
  }>;

  listOfferItems: (
    offerIds: string[],
  ) => Promise<{
    data: OfferItem[] | null;
    error: DatabaseError | null;
  }>;

  listRequests: (
    requestIds: string[],
  ) => Promise<{
    data: MealRequest[] | null;
    error: DatabaseError | null;
  }>;

  getCookOfferProfile: (
    userId: string,
  ) => Promise<{
    data: CookProfile | null;
    error: DatabaseError | null;
  }>;

  submitOffer: (
    functionName:
      | "create_and_submit_cook_offer"
      | "create_and_submit_standard_cook_offer",
    parameters: OfferSubmission,
  ) => Promise<{
    data: unknown;
    error: DatabaseError | null;
  }>;
};

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function getDatabaseErrorResponse(error: DatabaseError) {
  const message = error.message.toLowerCase();

  if (message.includes("authentication required")) {
    return {
      status: 401,
      error: "Authentication required.",
    };
  }

  if (message.includes("approved cook account required")) {
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
    message.includes("no longer available") ||
    message.includes("not accepting new requests")
  ) {
    return {
      status: 409,
      error: "This request or one of its selected menu items is no longer available.",
    };
  }

  if (message.includes("does not belong to your account")) {
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
    message.includes("requested plate quantity") ||
    message.includes("requested meal") ||
    message.includes("offer line") ||
    message.includes("complete plate") ||
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

export async function handleCookOffersGet(
  dependencies: CookOffersDependencies,
): Promise<Response> {
  const auth = await dependencies.authenticate();

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  if (auth.role !== "cook") {
    return jsonError("Cook access required.", 403);
  }

  const { data: profile, error: profileError } =
    await dependencies.getCookProfile(auth.user.id);

  if (profileError || !profile || profile.status !== "approved") {
    return jsonError(
      profileError
        ? "Unable to verify cook approval."
        : "An approved cook account is required.",
      profileError ? 500 : 403,
    );
  }

  const { data: offers, error: offersError } =
    await dependencies.listOffers(auth.user.id);

  if (offersError) {
    console.error("Cook submitted offer lookup failed:", offersError);
    return jsonError(
      "Unable to retrieve your submitted offers.",
      500,
    );
  }

  if (!offers?.length) {
    return Response.json({ offers: [] });
  }

  const offerIds = offers.map((offer) => offer.id);
  const requestIds = [
    ...new Set(offers.map((offer) => offer.request_id)),
  ];

  const [
    { data: items, error: itemsError },
    { data: requests, error: requestsError },
  ] = await Promise.all([
    dependencies.listOfferItems(offerIds),
    dependencies.listRequests(requestIds),
  ]);

  if (itemsError || requestsError) {
    console.error(
      "Cook submitted offer details lookup failed:",
      itemsError ?? requestsError,
    );

    return jsonError(
      "Unable to retrieve submitted offer details.",
      500,
    );
  }

  const itemsByOffer = new Map<string, OfferItem[]>();

  for (const item of items ?? []) {
    const current = itemsByOffer.get(item.offer_id) ?? [];
    current.push(item);
    itemsByOffer.set(item.offer_id, current);
  }

  const requestById = new Map(
    (requests ?? []).map((request) => [request.id, request]),
  );

  return Response.json({
    offers: offers.flatMap((offer) => {
      const request = requestById.get(offer.request_id);

      return request
        ? [
            {
              ...offer,
              items: itemsByOffer.get(offer.id) ?? [],
              request,
            },
          ]
        : [];
    }),
  });
}

export async function handleCookOffersPost(
  request: Request,
  dependencies: CookOffersDependencies,
): Promise<Response> {
  // 1. Authenticate the cook.
  const auth = await dependencies.authenticate();

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  if (auth.role !== "cook") {
    return jsonError("Cook access required.", 403);
  }

  // 2. Reject invalid or oversized declared request bodies.
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    const declaredBodyBytes = Number(contentLength);

    if (
      !Number.isSafeInteger(declaredBodyBytes) ||
      declaredBodyBytes < 0
    ) {
      return jsonError("Invalid request body size.", 400);
    }

    if (declaredBodyBytes > MAX_REQUEST_BODY_BYTES) {
      return jsonError("Request body is too large.", 413);
    }
  }

  // 3. Read the request while enforcing the actual byte limit.
  const bodyResult = await readRequestBody(
    request,
    MAX_REQUEST_BODY_BYTES,
  );

  if (!bodyResult.ok) {
    if (bodyResult.reason === "too_large") {
      return jsonError("Request body is too large.", 413);
    }

    return jsonError("Could not read request body.", 400);
  }

  // 4. Parse the JSON body.
  let body: unknown;

  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  // 5. Validate and normalize the offer.
  const isAlternative =
    typeof body === "object" &&
    body !== null &&
    (body as Record<string, unknown>).is_alternative === true;

  const validation = isAlternative
    ? validateCookOffer(body)
    : validateStandardCookOffer(body);

  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  // 6. Verify the cook's approval and availability.
  const { data: cookProfile, error: profileError } =
    await dependencies.getCookOfferProfile(auth.user.id);

  if (profileError) {
    console.error("Cook approval lookup failed:", {
      code: profileError.code,
      message: profileError.message,
    });

    return jsonError("Unable to verify cook approval.", 500);
  }

  if (!cookProfile || cookProfile.status !== "approved") {
    return jsonError(
      "An approved cook account is required.",
      403,
    );
  }

  if (!cookProfile.is_available) {
    return jsonError(
      "Your cook profile is paused and cannot submit new offers.",
      409,
    );
  }

  // 7. Submit through the appropriate atomic database function.
  const { data: offer, error: submissionError } =
    await dependencies.submitOffer(
      validation.value.is_alternative
        ? "create_and_submit_cook_offer"
        : "create_and_submit_standard_cook_offer",
      {
        p_request_id: validation.value.request_id,
        p_message: validation.value.is_alternative
          ? `{{STEURUN_ALTERNATIVE}} ${validation.value.message ?? ""}`
          : validation.value.message,
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

    return jsonError(response.error, response.status);
  }

  if (!offer) {
    console.error("Cook offer submission returned no result.");

    return jsonError(
      "Unable to confirm offer submission.",
      500,
    );
  }

  // 8. Return the database-confirmed submission result.
  return Response.json({ offer }, { status: 201 });
}
