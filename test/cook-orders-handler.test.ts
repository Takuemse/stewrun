import * as mocha from "mocha";
import assert from "node:assert";

import {
  handleCookOrdersGet,
  type CookOrdersDependencies,
} from "../lib/cook-orders-handler";
import type { CookOrder } from "../lib/cook-orders-client";
import type { AuthResult } from "../lib/supabase/auth.server";

const { describe, it } = mocha;

const cookId = "123e4567-e89b-42d3-a456-426614174000";

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

const order: CookOrder = {
  id: "987e6543-e21b-42d3-a456-426614174000",
  items: [
    {
      menu_item_id: null,
      name: "Stew",
      description: null,
      quantity: 2,
      unit_price: 5,
      line_total: 10,
    },
  ],
  status: "confirmed",
  payment_status: "paid",
  hub: "Eastgate",
  pickup_date: "2026-11-17",
  pickup_time: "12:00:00",
  meal_subtotal: 10,
  created_at: "2026-11-16T08:00:00Z",
  collected_at: null,
};

function createDependencies(
  overrides: Partial<CookOrdersDependencies> = {},
): CookOrdersDependencies {
  return {
    authenticate: async () => cookAuth,
    isApprovedCook: async () => ({
      approved: true,
      error: null,
    }),
    listOrders: async () => ({
      data: [order],
      error: null,
    }),
    ...overrides,
  };
}

async function getJson(
  response: Response,
): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("handleCookOrdersGet", () => {
  it("rejects unauthenticated users", async () => {
    const response = await handleCookOrdersGet(
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

  it("rejects customers without querying orders", async () => {
    let orderQueryCalled = false;

    const response = await handleCookOrdersGet(
      createDependencies({
        authenticate: async () => customerAuth,
        listOrders: async () => {
          orderQueryCalled = true;
          return { data: [], error: null };
        },
      }),
    );

    assert.strictEqual(response.status, 403);
    assert.strictEqual(orderQueryCalled, false);
  });

  it("requires an approved cook", async () => {
    let orderQueryCalled = false;

    const response = await handleCookOrdersGet(
      createDependencies({
        isApprovedCook: async () => ({
          approved: false,
          error: null,
        }),
        listOrders: async () => {
          orderQueryCalled = true;
          return { data: [], error: null };
        },
      }),
    );

    assert.strictEqual(response.status, 403);
    assert.strictEqual(orderQueryCalled, false);
  });

  it("calls the cook RPC without accepting a client identity", async () => {
    let orderQueryCalled = false;

    const response = await handleCookOrdersGet(
      createDependencies({
        listOrders: async () => {
          orderQueryCalled = true;
          return { data: [order], error: null };
        },
      }),
    );

    assert.strictEqual(response.status, 200);
    assert.strictEqual(orderQueryCalled, true);
  });

  it("maps an RPC rejection for an unapproved cook to forbidden", async () => {
    const response = await handleCookOrdersGet(
      createDependencies({
        isApprovedCook: async () => ({
          approved: true,
          error: null,
        }),
        listOrders: async () => ({
          data: null,
          error: { message: "Approved cook account required" },
        }),
      }),
    );

    assert.strictEqual(response.status, 403);
  });

  it("allowlists order and item fields in the response", async () => {
    const privateOrder = Object.assign({}, order, {
      customer_id: "customer-id",
      pickup_code: "secret",
      payment_reference: "provider-ref",
      payment_provider: "provider",
    });
    const privateItem = Object.assign({}, order.items[0], {
      private_note: "not allowed",
    });
    privateOrder.items = [privateItem];

    const response = await handleCookOrdersGet(
      createDependencies({
        listOrders: async () => ({
          data: [privateOrder],
          error: null,
        }),
      }),
    );
    const body = await getJson(response);
    const returnedOrder = (body.orders as Record<string, unknown>[])[0];
    const returnedItem = (returnedOrder.items as Record<string, unknown>[])[0];

    assert.deepStrictEqual(Object.keys(returnedOrder).sort(), [
      "collected_at",
      "created_at",
      "hub",
      "id",
      "items",
      "meal_subtotal",
      "payment_status",
      "pickup_date",
      "pickup_time",
      "status",
    ]);
    assert.deepStrictEqual(Object.keys(returnedItem).sort(), [
      "description",
      "line_total",
      "menu_item_id",
      "name",
      "quantity",
      "unit_price",
    ]);
  });

  it("returns a generic server error when the order query fails", async () => {
    const response = await handleCookOrdersGet(
      createDependencies({
        listOrders: async () => ({
          data: null,
          error: { message: "private database detail" },
        }),
      }),
    );
    const body = await getJson(response);

    assert.strictEqual(response.status, 500);
    assert.deepStrictEqual(body, {
      error: "Unable to retrieve cook orders.",
    });
  });
});
