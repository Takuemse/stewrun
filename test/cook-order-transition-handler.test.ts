
import * as mocha from "mocha";
import assert from "node:assert";

import {
  handleCookOrderTransition,
  type CookOrderTransitionDependencies,
} from "../lib/cook-order-transition-handler";

import type { AuthResult } from "../lib/supabase/auth.server";

const { describe, it } = mocha;

const validOrderId = "123e4567-e89b-42d3-a456-426614174000";

const cookAuth = {
  ok: true,
  role: "cook",
  user: {},
} as unknown as AuthResult;

const customerAuth = {
  ok: true,
  role: "customer",
  user: {},
} as unknown as AuthResult;

function createDependencies(
  overrides: Partial<CookOrderTransitionDependencies> = {},
): CookOrderTransitionDependencies {
  return {
    authenticate: async () => cookAuth,
    markOrderReady: async () => ({
      data: "order_marked_ready",
      error: null,
    }),
    confirmOrderCollection: async () => ({
      data: "order_collected",
      error: null,
    }),
    ...overrides,
  };
}

function createRequest(
  body?: unknown,
  method = "POST",
): Request {
  return new Request(
    "http://localhost/api/cook/orders/test",
    {
      method,
      headers: {
        "content-type": "application/json",
      },
      ...(body === undefined
        ? {}
        : {
            body: typeof body === "string"
              ? body
              : JSON.stringify(body),
          }),
    },
  );
}

async function getJson(
  response: Response,
): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("handleCookOrderTransition", () => {
  describe("authentication and authorization", () => {
    it("rejects unauthenticated users", async () => {
      const response = await handleCookOrderTransition(
        createRequest(),
        validOrderId,
        "ready",
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

    it("returns an error when authentication fails unexpectedly", async () => {
      const response = await handleCookOrderTransition(
        createRequest(),
        validOrderId,
        "ready",
        createDependencies({
          authenticate: async () => {
            throw new Error("Authentication service failed");
          },
        }),
      );

      assert.strictEqual(response.status, 500);
    });

    it("rejects authenticated customers", async () => {
      const response = await handleCookOrderTransition(
        createRequest(),
        validOrderId,
        "ready",
        createDependencies({
          authenticate: async () => customerAuth,
        }),
      );

      assert.strictEqual(response.status, 403);
    });

    it("does not call the RPC for unauthorized users", async () => {
      let rpcCalled = false;

      const response = await handleCookOrderTransition(
        createRequest(),
        validOrderId,
        "ready",
        createDependencies({
          authenticate: async () => customerAuth,
          markOrderReady: async () => {
            rpcCalled = true;
            return { data: "order_marked_ready", error: null };
          },
        }),
      );

      assert.strictEqual(response.status, 403);
      assert.strictEqual(rpcCalled, false);
    });
  });

  describe("order ID validation", () => {
    it("rejects an invalid order ID", async () => {
      const response = await handleCookOrderTransition(
        createRequest(),
        "not-a-uuid",
        "ready",
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("does not call the RPC for an invalid order ID", async () => {
      let rpcCalled = false;

      const response = await handleCookOrderTransition(
        createRequest(),
        "invalid",
        "ready",
        createDependencies({
          markOrderReady: async () => {
            rpcCalled = true;
            return { data: "order_marked_ready", error: null };
          },
        }),
      );

      assert.strictEqual(response.status, 400);
      assert.strictEqual(rpcCalled, false);
    });
  });

  describe("mark order ready", () => {
    it("marks an order ready successfully", async () => {
      let receivedOrderId = "";

      const response = await handleCookOrderTransition(
        createRequest(),
        validOrderId,
        "ready",
        createDependencies({
          markOrderReady: async (orderId) => {
            receivedOrderId = orderId;
            return { data: "order_marked_ready", error: null };
          },
        }),
      );

      const body = await getJson(response);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(receivedOrderId, validOrderId);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.result, "order_marked_ready");
    });

    it("handles an order that is already ready", async () => {
      const response = await handleCookOrderTransition(
        createRequest(),
        validOrderId,
        "ready",
        createDependencies({
          markOrderReady: async () => ({
            data: "already_ready",
            error: null,
          }),
        }),
      );

      const body = await getJson(response);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(body.result, "already_ready");
    });

    it("maps an unpaid order to conflict", async () => {
      const response = await handleCookOrderTransition(
        createRequest(),
        validOrderId,
        "ready",
        createDependencies({
          markOrderReady: async () => ({
            data: null,
            error: {
              message: "Order payment has not been confirmed",
            },
          }),
        }),
      );

      assert.strictEqual(response.status, 409);
    });

    it("maps an unapproved cook to forbidden", async () => {
      const response = await handleCookOrderTransition(
        createRequest(),
        validOrderId,
        "ready",
        createDependencies({
          markOrderReady: async () => ({
            data: null,
            error: {
              message: "Approved cook account required",
            },
          }),
        }),
      );

      assert.strictEqual(response.status, 403);
    });

    it("maps an unassigned order to not found", async () => {
      const response = await handleCookOrderTransition(
        createRequest(),
        validOrderId,
        "ready",
        createDependencies({
          markOrderReady: async () => ({
            data: null,
            error: {
              message: "Assigned order not found",
            },
          }),
        }),
      );

      assert.strictEqual(response.status, 404);
    });

    it("does not expose unexpected database error details", async () => {
      const response = await handleCookOrderTransition(
        createRequest(),
        validOrderId,
        "ready",
        createDependencies({
          markOrderReady: async () => ({
            data: null,
            error: {
              message: "Internal database details",
            },
          }),
        }),
      );

      const body = await getJson(response);

      assert.strictEqual(response.status, 500);
      assert.strictEqual(
        body.error,
        "Unable to update the order.",
      );
      assert.strictEqual(
        JSON.stringify(body).includes("Internal database details"),
        false,
      );
    });

    it("handles an unexpected RPC exception", async () => {
      const response = await handleCookOrderTransition(
        createRequest(),
        validOrderId,
        "ready",
        createDependencies({
          markOrderReady: async () => {
            throw new Error("Database unavailable");
          },
        }),
      );

      assert.strictEqual(response.status, 500);
    });
  });

  describe("confirm order collection", () => {
    it("confirms collection with the supplied pickup code", async () => {
      let receivedOrderId = "";
      let receivedPickupCode = "";

      const response = await handleCookOrderTransition(
        createRequest({ pickupCode: "  123456  " }),
        validOrderId,
        "collect",
        createDependencies({
          confirmOrderCollection: async (orderId, pickupCode) => {
            receivedOrderId = orderId;
            receivedPickupCode = pickupCode;

            return { data: "order_collected", error: null };
          },
        }),
      );

      const body = await getJson(response);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(receivedOrderId, validOrderId);
      assert.strictEqual(receivedPickupCode, "123456");
      assert.strictEqual(body.result, "order_collected");
    });

    it("handles an order that is already collected", async () => {
      const response = await handleCookOrderTransition(
        createRequest({ pickupCode: "123456" }),
        validOrderId,
        "collect",
        createDependencies({
          confirmOrderCollection: async () => ({
            data: "already_collected",
            error: null,
          }),
        }),
      );

      const body = await getJson(response);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(body.result, "already_collected");
    });

    it("rejects malformed JSON", async () => {
      const response = await handleCookOrderTransition(
        createRequest("{invalid json"),
        validOrderId,
        "collect",
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects a non-object body", async () => {
      const response = await handleCookOrderTransition(
        createRequest(["123456"]),
        validOrderId,
        "collect",
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects a missing pickup code", async () => {
      const response = await handleCookOrderTransition(
        createRequest({}),
        validOrderId,
        "collect",
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects an empty pickup code", async () => {
      const response = await handleCookOrderTransition(
        createRequest({ pickupCode: "   " }),
        validOrderId,
        "collect",
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects a non-string pickup code", async () => {
      const response = await handleCookOrderTransition(
        createRequest({ pickupCode: 123456 }),
        validOrderId,
        "collect",
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects an excessively long pickup code", async () => {
      const response = await handleCookOrderTransition(
        createRequest({ pickupCode: "1".repeat(65) }),
        validOrderId,
        "collect",
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("maps an incorrect pickup code to bad request", async () => {
      const response = await handleCookOrderTransition(
        createRequest({ pickupCode: "999999" }),
        validOrderId,
        "collect",
        createDependencies({
          confirmOrderCollection: async () => ({
            data: null,
            error: { message: "Invalid pickup code" },
          }),
        }),
      );

      assert.strictEqual(response.status, 400);
    });

    it("maps an order that is not ready to conflict", async () => {
      const response = await handleCookOrderTransition(
        createRequest({ pickupCode: "123456" }),
        validOrderId,
        "collect",
        createDependencies({
          confirmOrderCollection: async () => ({
            data: null,
            error: {
              message: "Order is not ready for collection",
            },
          }),
        }),
      );

      assert.strictEqual(response.status, 409);
    });

    it("does not call the collection RPC for invalid input", async () => {
      let rpcCalled = false;

      const response = await handleCookOrderTransition(
        createRequest({ pickupCode: "" }),
        validOrderId,
        "collect",
        createDependencies({
          confirmOrderCollection: async () => {
            rpcCalled = true;
            return { data: "order_collected", error: null };
          },
        }),
      );

      assert.strictEqual(response.status, 400);
      assert.strictEqual(rpcCalled, false);
    });

    it("handles an unexpected RPC exception", async () => {
      const response = await handleCookOrderTransition(
        createRequest({ pickupCode: "123456" }),
        validOrderId,
        "collect",
        createDependencies({
          confirmOrderCollection: async () => {
            throw new Error("Database unavailable");
          },
        }),
      );

      assert.strictEqual(response.status, 500);
    });
  });

  describe("method validation", () => {
    it("rejects non-POST requests", async () => {
      const response = await handleCookOrderTransition(
        createRequest(undefined, "GET"),
        validOrderId,
        "ready",
        createDependencies(),
      );

      assert.strictEqual(response.status, 405);
    });

    it("does not call the RPC for a non-POST request", async () => {
      let rpcCalled = false;

      const response = await handleCookOrderTransition(
        createRequest(undefined, "GET"),
        validOrderId,
        "ready",
        createDependencies({
          markOrderReady: async () => {
            rpcCalled = true;
            return { data: "order_marked_ready", error: null };
          },
        }),
      );

      assert.strictEqual(response.status, 405);
      assert.strictEqual(rpcCalled, false);
    });
  });
});
