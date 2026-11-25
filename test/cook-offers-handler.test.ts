
import * as mocha from "mocha";
import assert from "node:assert";

import {
  handleCookOffersGet,
  handleCookOffersPost,
  type CookOffersDependencies,
} from "../lib/cook-offers-handler";

import type { AuthResult } from "../lib/supabase/auth.server";

const { describe, it } = mocha;

const cookId = "123e4567-e89b-42d3-a456-426614174000";
const requestId = "987e6543-e21b-42d3-a456-426614174000";
const offerId = "456e7890-e12b-42d3-a456-426614174000";

const cookAuth = {
  ok: true,
  role: "cook",
  user: { id: cookId },
} as unknown as AuthResult;

const customerAuth = {
  ok: true,
  role: "customer",
  user: { id: cookId },
} as unknown as AuthResult;

const submittedOffer = {
  id: offerId,
  request_id: requestId,
  total_price: 10,
  submitted_at: "2026-11-24T08:00:00Z",
};

const offerItem = {
  offer_id: offerId,
  name: "Beef stew",
  description: "Beef stew with sadza and vegetables",
  quantity: 2,
  unit_price: 5,
  line_total: 10,
};

const mealRequest = {
  id: requestId,
  items: [{ name: "Beef stew", quantity: 2 }],
  hub: "Joina City",
  pickup_date: "2026-11-25",
  pickup_time: "12:00:00",
};

const validStandardOffer = {
  request_id: requestId,
  message: "Freshly prepared lunch.",
  items: [
    {
      name: "Beef stew",
      description: "Beef stew with sadza and vegetables",
      quantity: 2,
      unit_price: 5,
    },
  ],
};

const validAlternativeOffer = {
  request_id: requestId,
  is_alternative: true,
  message: "A different meal option.",
  items: [
    {
      name: "Chicken rice",
      description: "Chicken with rice and vegetables",
      quantity: 2,
      unit_price: 4.5,
    },
  ],
};

function createDependencies(
  overrides: Partial<CookOffersDependencies> = {},
): CookOffersDependencies {
  return {
    authenticate: async () => cookAuth,

    getCookProfile: async () => ({
      data: { status: "approved" },
      error: null,
    }),

    listOffers: async () => ({
      data: [],
      error: null,
    }),

    listOfferItems: async () => ({
      data: [],
      error: null,
    }),

    listRequests: async () => ({
      data: [],
      error: null,
    }),

    getCookOfferProfile: async () => ({
      data: {
        status: "approved",
        is_available: true,
      },
      error: null,
    }),

    submitOffer: async () => ({
      data: { id: offerId },
      error: null,
    }),

    ...overrides,
  };
}

function createPostRequest(
  body: unknown,
  headers?: HeadersInit,
): Request {
  return new Request("http://localhost/api/cook/offers", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(headers).entries()),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function getJson(
  response: Response,
): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("handleCookOffersGet", () => {
  it("rejects unauthenticated users", async () => {
    const response = await handleCookOffersGet(
      createDependencies({
        authenticate: async () => ({
          ok: false,
          status: 401,
          error: "Authentication required.",
        }),
      }),
    );

    assert.strictEqual(response.status, 401);
  });

  it("rejects customers without querying cook offers", async () => {
    let queryCalled = false;

    const response = await handleCookOffersGet(
      createDependencies({
        authenticate: async () => customerAuth,
        getCookProfile: async () => {
          queryCalled = true;
          return {
            data: { status: "approved" },
            error: null,
          };
        },
      }),
    );

    assert.strictEqual(response.status, 403);
    assert.strictEqual(queryCalled, false);
  });

  it("requires an approved cook", async () => {
    let offersQueried = false;

    const response = await handleCookOffersGet(
      createDependencies({
        getCookProfile: async () => ({
          data: { status: "pending" },
          error: null,
        }),
        listOffers: async () => {
          offersQueried = true;
          return { data: [], error: null };
        },
      }),
    );

    assert.strictEqual(response.status, 403);
    assert.strictEqual(offersQueried, false);
  });

  it("returns a server error when cook approval cannot be verified", async () => {
    const response = await handleCookOffersGet(
      createDependencies({
        getCookProfile: async () => ({
          data: null,
          error: { message: "Database unavailable" },
        }),
      }),
    );

    assert.strictEqual(response.status, 500);
  });

  it("returns an empty offer list when no submitted offers exist", async () => {
    const response = await handleCookOffersGet(
      createDependencies(),
    );
    const body = await getJson(response);

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(body, { offers: [] });
  });

  it("returns submitted offers with their items and request details", async () => {
    const response = await handleCookOffersGet(
      createDependencies({
        listOffers: async () => ({
          data: [submittedOffer],
          error: null,
        }),
        listOfferItems: async () => ({
          data: [offerItem],
          error: null,
        }),
        listRequests: async () => ({
          data: [mealRequest],
          error: null,
        }),
      }),
    );

    const body = await getJson(response);
    const offers = body.offers as Record<string, unknown>[];

    assert.strictEqual(response.status, 200);
    assert.strictEqual(offers.length, 1);
    assert.deepStrictEqual(offers[0], {
      ...submittedOffer,
      items: [offerItem],
      request: mealRequest,
    });
  });

  it("returns a server error when the submitted-offer query fails", async () => {
    const response = await handleCookOffersGet(
      createDependencies({
        listOffers: async () => ({
          data: null,
          error: { message: "Private database detail" },
        }),
      }),
    );

    const body = await getJson(response);

    assert.strictEqual(response.status, 500);
    assert.deepStrictEqual(body, {
      error: "Unable to retrieve your submitted offers.",
    });
  });

  it("returns a server error when offer-item lookup fails", async () => {
    const response = await handleCookOffersGet(
      createDependencies({
        listOffers: async () => ({
          data: [submittedOffer],
          error: null,
        }),
        listOfferItems: async () => ({
          data: null,
          error: { message: "Database unavailable" },
        }),
      }),
    );

    assert.strictEqual(response.status, 500);
  });

  it("returns a server error when request-detail lookup fails", async () => {
    const response = await handleCookOffersGet(
      createDependencies({
        listOffers: async () => ({
          data: [submittedOffer],
          error: null,
        }),
        listRequests: async () => ({
          data: null,
          error: { message: "Database unavailable" },
        }),
      }),
    );

    assert.strictEqual(response.status, 500);
  });

  it("does not return offers whose meal request details are missing", async () => {
    const response = await handleCookOffersGet(
      createDependencies({
        listOffers: async () => ({
          data: [submittedOffer],
          error: null,
        }),
        listOfferItems: async () => ({
          data: [offerItem],
          error: null,
        }),
        listRequests: async () => ({
          data: [],
          error: null,
        }),
      }),
    );

    const body = await getJson(response);

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(body, { offers: [] });
  });
});

describe("handleCookOffersPost", () => {
  it("rejects unauthenticated users before reading the request body", async () => {
    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer),
      createDependencies({
        authenticate: async () => ({
          ok: false,
          status: 401,
          error: "Authentication required.",
        }),
      }),
    );

    assert.strictEqual(response.status, 401);
  });

  it("rejects customers without checking cook availability", async () => {
    let profileQueried = false;

    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer),
      createDependencies({
        authenticate: async () => customerAuth,
        getCookOfferProfile: async () => {
          profileQueried = true;
          return {
            data: {
              status: "approved",
              is_available: true,
            },
            error: null,
          };
        },
      }),
    );

    assert.strictEqual(response.status, 403);
    assert.strictEqual(profileQueried, false);
  });

  it("rejects an invalid declared content length", async () => {
    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer, {
        "content-length": "-1",
      }),
      createDependencies(),
    );

    assert.strictEqual(response.status, 400);
  });

  it("rejects a non-numeric declared content length", async () => {
    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer, {
        "content-length": "invalid",
      }),
      createDependencies(),
    );

    assert.strictEqual(response.status, 400);
  });

  it("rejects a declared body larger than 32 KB", async () => {
    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer, {
        "content-length": "32769",
      }),
      createDependencies(),
    );

    assert.strictEqual(response.status, 413);
  });

  it("rejects an actual body larger than 32 KB", async () => {
    const response = await handleCookOffersPost(
      createPostRequest("x".repeat(32_769)),
      createDependencies(),
    );

    assert.strictEqual(response.status, 413);
  });

  it("rejects malformed JSON", async () => {
    const response = await handleCookOffersPost(
      createPostRequest("{invalid json"),
      createDependencies(),
    );

    assert.strictEqual(response.status, 400);
  });

  it("rejects an invalid standard offer before querying the database", async () => {
    let profileQueried = false;

    const response = await handleCookOffersPost(
      createPostRequest({
        request_id: "invalid-id",
        items: [],
      }),
      createDependencies({
        getCookOfferProfile: async () => {
          profileQueried = true;
          return {
            data: {
              status: "approved",
              is_available: true,
            },
            error: null,
          };
        },
      }),
    );

    assert.strictEqual(response.status, 400);
    assert.strictEqual(profileQueried, false);
  });

  it("requires an approved cook before submission", async () => {
    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer),
      createDependencies({
        getCookOfferProfile: async () => ({
          data: { status: "pending", is_available: true },
          error: null,
        }),
      }),
    );

    assert.strictEqual(response.status, 403);
  });

  it("returns a server error when cook-profile lookup fails", async () => {
    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer),
      createDependencies({
        getCookOfferProfile: async () => ({
          data: null,
          error: { message: "Database unavailable" },
        }),
      }),
    );

    assert.strictEqual(response.status, 500);
  });

  it("prevents paused cooks from submitting offers", async () => {
    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer),
      createDependencies({
        getCookOfferProfile: async () => ({
          data: {
            status: "approved",
            is_available: false,
          },
          error: null,
        }),
      }),
    );

    const body = await getJson(response);

    assert.strictEqual(response.status, 409);
    assert.strictEqual(
      body.error,
      "Your cook profile is paused and cannot submit new offers.",
    );
  });

  it("uses the standard-offer RPC for standard offers", async () => {
    let selectedFunction = "";

    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer),
      createDependencies({
        submitOffer: async (functionName) => {
          selectedFunction = functionName;
          return {
            data: { id: offerId },
            error: null,
          };
        },
      }),
    );

    assert.strictEqual(response.status, 201);
    assert.strictEqual(
      selectedFunction,
      "create_and_submit_standard_cook_offer",
    );
  });

  it("uses the alternative-offer RPC and marker for alternatives", async () => {
    let selectedFunction = "";
    let submittedMessage: string | null = null;

    const response = await handleCookOffersPost(
      createPostRequest(validAlternativeOffer),
      createDependencies({
        submitOffer: async (functionName, parameters) => {
          selectedFunction = functionName;
          submittedMessage = parameters.p_message;

          return {
            data: { id: offerId },
            error: null,
          };
        },
      }),
    );

    assert.strictEqual(response.status, 201);
    assert.strictEqual(
      selectedFunction,
      "create_and_submit_cook_offer",
    );
    assert.strictEqual(
      submittedMessage,
      "{{STEURUN_ALTERNATIVE}} A different meal option.",
    );
  });

  it("returns the database-confirmed offer with status 201", async () => {
    const expectedOffer = { id: offerId, total_price: 10 };

    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer),
      createDependencies({
        submitOffer: async () => ({
          data: expectedOffer,
          error: null,
        }),
      }),
    );

    const body = await getJson(response);

    assert.strictEqual(response.status, 201);
    assert.deepStrictEqual(body, { offer: expectedOffer });
  });

  it("maps duplicate offers to conflict", async () => {
    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer),
      createDependencies({
        submitOffer: async () => ({
          data: null,
          error: {
            code: "23505",
            message: "duplicate key value violates unique constraint",
          },
        }),
      }),
    );

    assert.strictEqual(response.status, 409);
  });

  it("maps closed requests to conflict", async () => {
    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer),
      createDependencies({
        submitOffer: async () => ({
          data: null,
          error: {
            message: "Meal request is no longer open",
          },
        }),
      }),
    );

    assert.strictEqual(response.status, 409);
  });

  it("maps invalid menu-item ownership to a bad request", async () => {
    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer),
      createDependencies({
        submitOffer: async () => ({
          data: null,
          error: {
            message: "Menu item does not belong to your account",
          },
        }),
      }),
    );

    assert.strictEqual(response.status, 400);
  });

  it("does not expose unexpected database error details", async () => {
    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer),
      createDependencies({
        submitOffer: async () => ({
          data: null,
          error: {
            message: "Private internal database detail",
          },
        }),
      }),
    );

    const body = await getJson(response);

    assert.strictEqual(response.status, 500);
    assert.deepStrictEqual(body, {
      error: "Unable to submit your offer. Please try again.",
    });
  });

  it("rejects a successful RPC response with no offer result", async () => {
    const response = await handleCookOffersPost(
      createPostRequest(validStandardOffer),
      createDependencies({
        submitOffer: async () => ({
          data: null,
          error: null,
        }),
      }),
    );

    assert.strictEqual(response.status, 500);
  });
});
