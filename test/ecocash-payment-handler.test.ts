
import * as mocha from "mocha";
import assert from "node:assert";

import {
  createEcoCashPaymentHandler,
} from "../lib/server/ecocash-payment-handler.server";

import type {
  EcoCashPaymentHandlerDependencies,
} from "../lib/server/ecocash-payment-handler.types";

import type { AuthResult } from "../lib/supabase/auth.server";
import type { PaymentRepository } from "../lib/server/ecocash-payment-types";

const { describe, it } = mocha;

const ORDER_ID = "123e4567-e89b-42d3-a456-426614174000";

const customerAuth = {
  ok: true,
  role: "customer",
  user: { id: "customer-test-id" },
} as unknown as AuthResult;

const cookAuth = {
  ok: true,
  role: "cook",
  user: { id: "cook-test-id" },
} as unknown as AuthResult;

const validAttempt = {
  payment_transaction_id: "payment-test-id",
  client_correlator: "correlator-test",
  reference_code: "reference-test",
  end_user_id: "+263771234567",
  amount: "12.50",
  currency: "USD",
  expires_at: "2026-11-12T10:00:00.000Z",
};

function createRepository(
  overrides: Partial<PaymentRepository> = {},
): PaymentRepository {
  return {
    createAttempt: async () => ({
      data: [validAttempt],
      error: null,
    }),

    updateAttempt: async () => ({
      data: { id: "payment-test-id" },
      error: null,
    }),

    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<EcoCashPaymentHandlerDependencies> = {},
): EcoCashPaymentHandlerDependencies {
  return {
    authenticate: async () => customerAuth,

    createRepository: () => createRepository(),

    ensureProviderConfigured: () => undefined,

    initiateCharge: async () => ({
      outcome: "acknowledged",
      providerStatus: "Charged",
      responseCode: "00",
      providerReference: "ECO-TEST-001",
    }),

    createId: () => "generated-test-id",

    now: () => "2026-11-12T08:00:00.000Z",

    ...overrides,
  };
}

function createRequest(
  body: unknown,
  contentType = "application/json",
): Request {
  return new Request(
    "http://localhost/api/orders/payment",
    {
      method: "POST",
      headers: {
        "content-type": contentType,
      },
      body: typeof body === "string"
        ? body
        : JSON.stringify(body),
    },
  );
}

async function getJson(
  response: Response,
): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

async function assertUncertainResponse(
  response: Response,
): Promise<void> {
  assert.strictEqual(response.status, 503);

  const body = await getJson(response);

  assert.strictEqual(body.code, "PAYMENT_STATUS_UNCERTAIN");
}

async function assertDefiniteResponse(
  response: Response,
): Promise<void> {
  const body = await getJson(response);

  assert.strictEqual(body.code, undefined);
}

async function callHandler(
  request: Request,
  dependencies: EcoCashPaymentHandlerDependencies,
  orderId = ORDER_ID,
): Promise<Response> {
  const handler = createEcoCashPaymentHandler(dependencies);

  return handler({ request, orderId });
}

describe("EcoCash payment handler", () => {
  describe("authentication and authorization", () => {
    it("rejects unauthenticated users", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
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

    it("rejects authenticated cooks", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          authenticate: async () => cookAuth,
        }),
      );

      assert.strictEqual(response.status, 403);
    });

    it("handles unexpected authentication errors", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          authenticate: async () => {
            throw new Error("Unexpected authentication failure");
          },
        }),
      );

      assert.strictEqual(response.status, 500);
      assert.strictEqual(
        (await getJson(response)).error,
        "Unable to verify authentication.",
      );
    });
  });

  describe("request validation", () => {
    it("rejects invalid order IDs", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies(),
        "not-a-uuid",
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects oversized request bodies", async () => {
      const response = await callHandler(
        createRequest({
          phoneNumber: "0771234567",
          padding: "x".repeat(2048),
        }),
        createDependencies(),
      );

      assert.strictEqual(response.status, 413);
    });

    it("rejects unsupported content types", async () => {
      const response = await callHandler(
        createRequest(
          { phoneNumber: "0771234567" },
          "text/plain",
        ),
        createDependencies(),
      );

      assert.strictEqual(response.status, 415);
    });

    it("rejects malformed JSON", async () => {
      const response = await callHandler(
        createRequest("{invalid json"),
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects a non-object JSON body", async () => {
      const response = await callHandler(
        createRequest(["0771234567"]),
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects a missing phone number", async () => {
      const response = await callHandler(
        createRequest({}),
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects an invalid EcoCash phone number", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "071234" }),
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });
  });

  describe("dependency initialization", () => {
    it("returns a definite 503 when provider configuration is invalid", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          ensureProviderConfigured: () => {
            throw new Error("Invalid provider configuration");
          },
        }),
      );

      assert.strictEqual(response.status, 503);
      await assertDefiniteResponse(response);
    });

    it("returns a definite 503 when repository creation fails", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () => {
            throw new Error("Database client unavailable");
          },
        }),
      );

      assert.strictEqual(response.status, 503);
      await assertDefiniteResponse(response);
    });
  });

  describe("payment attempt creation", () => {
    it("returns 404 when the order is unavailable", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () =>
            createRepository({
              createAttempt: async () => ({
                data: null,
                error: { code: "42501" },
              }),
            }),
        }),
      );

      assert.strictEqual(response.status, 404);
      await assertDefiniteResponse(response);
    });

    it("returns 409 when another payment attempt is active", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () =>
            createRepository({
              createAttempt: async () => ({
                data: null,
                error: { code: "23505" },
              }),
            }),
        }),
      );

      assert.strictEqual(response.status, 409);
      await assertDefiniteResponse(response);
    });

    it("returns a definite 500 for an explicit unexpected database error", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () =>
            createRepository({
              createAttempt: async () => ({
                data: null,
                error: { code: "XX000" },
              }),
            }),
        }),
      );

      assert.strictEqual(response.status, 500);
      await assertDefiniteResponse(response);
    });

    it("returns an uncertain response when the database operation throws", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () =>
            createRepository({
              createAttempt: async () => {
                throw new Error("Database connection lost");
              },
            }),
        }),
      );

      await assertUncertainResponse(response);
    });

    it("classifies malformed payment attempt data as uncertain", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () =>
            createRepository({
              createAttempt: async () => ({
                data: [{ payment_transaction_id: "incomplete" }],
                error: null,
              }),
            }),
        }),
      );

      await assertUncertainResponse(response);
    });
  });

  describe("provider outcomes", () => {
    it("stores acknowledged provider responses as pending", async () => {
      let capturedUpdate:
        | Parameters<PaymentRepository["updateAttempt"]>[1]
        | undefined;

      let capturedId: string | undefined;

      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () =>
            createRepository({
              updateAttempt: async (id, update) => {
                capturedId = id;
                capturedUpdate = update;

                return {
                  data: { id: "payment-test-id" },
                  error: null,
                };
              },
            }),
        }),
      );

      assert.strictEqual(response.status, 202);
      assert.strictEqual(capturedId, "payment-test-id");
      assert.strictEqual(capturedUpdate?.status, "pending");

      if (capturedUpdate?.status === "pending") {
        assert.strictEqual(capturedUpdate.provider_status, "Charged");
        assert.strictEqual(capturedUpdate.response_code, "00");
        assert.strictEqual(
          capturedUpdate.provider_reference,
          "ECO-TEST-001",
        );
        assert.strictEqual(
          capturedUpdate.updated_at,
          "2026-11-12T08:00:00.000Z",
        );
      }
    });

    it("stores uncertain provider responses as reconciliation_required", async () => {
      let capturedUpdate:
        | Parameters<PaymentRepository["updateAttempt"]>[1]
        | undefined;

      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          initiateCharge: async () => ({
            outcome: "uncertain",
            reason: "Provider response timed out.",
          }),
          createRepository: () =>
            createRepository({
              updateAttempt: async (_id, update) => {
                capturedUpdate = update;

                return {
                  data: { id: "payment-test-id" },
                  error: null,
                };
              },
            }),
        }),
      );

      await assertUncertainResponse(response);
      assert.strictEqual(
        capturedUpdate?.status,
        "reconciliation_required",
      );

      if (capturedUpdate?.status === "reconciliation_required") {
        assert.strictEqual(
          capturedUpdate.failure_reason,
          "Provider response timed out.",
        );
      }
    });

    it("treats unexpected provider exceptions as uncertain", async () => {
      let capturedUpdate:
        | Parameters<PaymentRepository["updateAttempt"]>[1]
        | undefined;

      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          initiateCharge: async () => {
            throw new Error("Provider connection lost");
          },
          createRepository: () =>
            createRepository({
              updateAttempt: async (_id, update) => {
                capturedUpdate = update;

                return {
                  data: { id: "payment-test-id" },
                  error: null,
                };
              },
            }),
        }),
      );

      await assertUncertainResponse(response);
      assert.strictEqual(
        capturedUpdate?.status,
        "reconciliation_required",
      );

      if (capturedUpdate?.status === "reconciliation_required") {
        assert.strictEqual(
          capturedUpdate.failure_reason,
          "The provider response could not be safely determined.",
        );
      }
    });
  });

  describe("payment status persistence", () => {
    it("returns an uncertain response when the status update throws", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () =>
            createRepository({
              updateAttempt: async () => {
                throw new Error("Database connection lost");
              },
            }),
        }),
      );

      await assertUncertainResponse(response);

      const body = await getJson(
        new Response(
          JSON.stringify({
            error:
              "Payment status could not be confirmed. Do not retry this payment. Contact support.",
          }),
        ),
      );

      assert.strictEqual(
        body.error,
        "Payment status could not be confirmed. Do not retry this payment. Contact support.",
      );
    });

    it("returns an uncertain response when the database reports an update error", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () =>
            createRepository({
              updateAttempt: async () => ({
                data: null,
                error: { code: "XX000" },
              }),
            }),
        }),
      );

      await assertUncertainResponse(response);
    });

    it("returns an uncertain response when no payment transaction row is updated", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () =>
            createRepository({
              updateAttempt: async () => ({
                data: null,
                error: null,
              }),
            }),
        }),
      );

      await assertUncertainResponse(response);
    });
  });

  describe("payment attempt validation", () => {
    it("classifies a zero payment amount as uncertain before contacting EcoCash", async () => {
      let providerCalled = false;

      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () =>
            createRepository({
              createAttempt: async () => ({
                data: [{ ...validAttempt, amount: "0" }],
                error: null,
              }),
            }),
          initiateCharge: async () => {
            providerCalled = true;

            return {
              outcome: "acknowledged",
              providerStatus: "Charged",
              responseCode: "00",
              providerReference: "ECO-TEST-001",
            };
          },
        }),
      );

      await assertUncertainResponse(response);
      assert.strictEqual(providerCalled, false);
    });

    it("classifies a non-numeric payment amount as uncertain before contacting EcoCash", async () => {
      let providerCalled = false;

      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () =>
            createRepository({
              createAttempt: async () => ({
                data: [{ ...validAttempt, amount: "invalid" }],
                error: null,
              }),
            }),
          initiateCharge: async () => {
            providerCalled = true;

            return {
              outcome: "acknowledged",
              providerStatus: "Charged",
              responseCode: "00",
              providerReference: "ECO-TEST-001",
            };
          },
        }),
      );

      await assertUncertainResponse(response);
      assert.strictEqual(providerCalled, false);
    });

    it("classifies unsupported currencies as uncertain before contacting EcoCash", async () => {
      let providerCalled = false;

      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createRepository: () =>
            createRepository({
              createAttempt: async () => ({
                data: [{ ...validAttempt, currency: "ZWL" }],
                error: null,
              }),
            }),
          initiateCharge: async () => {
            providerCalled = true;

            return {
              outcome: "acknowledged",
              providerStatus: "Charged",
              responseCode: "00",
              providerReference: "ECO-TEST-001",
            };
          },
        }),
      );

      await assertUncertainResponse(response);
      assert.strictEqual(providerCalled, false);
    });
  });

  describe("payment data mapping", () => {
    it("passes normalized customer and payment details to the correct dependencies", async () => {
      let capturedCreateInput:
        | Parameters<PaymentRepository["createAttempt"]>[0]
        | undefined;

      let capturedProviderInput:
        | Parameters<EcoCashPaymentHandlerDependencies["initiateCharge"]>[0]
        | undefined;

      let idCallCount = 0;

      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies({
          createId: () => {
            idCallCount += 1;
            return `generated-id-${idCallCount}`;
          },
          createRepository: () =>
            createRepository({
              createAttempt: async (input) => {
                capturedCreateInput = input;

                return {
                  data: [validAttempt],
                  error: null,
                };
              },
            }),
          initiateCharge: async (input) => {
            capturedProviderInput = input;

            return {
              outcome: "acknowledged",
              providerStatus: "Charged",
              responseCode: "00",
              providerReference: "ECO-TEST-001",
            };
          },
        }),
      );

      assert.strictEqual(response.status, 202);

      assert.strictEqual(capturedCreateInput?.orderId, ORDER_ID);
      assert.strictEqual(
        capturedCreateInput?.customerId,
        "customer-test-id",
      );
      assert.strictEqual(
        capturedCreateInput?.phoneNumber,
        "+263771234567",
      );
      assert.strictEqual(
        capturedCreateInput?.clientCorrelator,
        "generated-id-1",
      );
      assert.strictEqual(
        capturedCreateInput?.referenceCode,
        "generated-id-2",
      );
      assert.strictEqual(idCallCount, 2);

      assert.deepStrictEqual(capturedProviderInput, {
        clientCorrelator: "correlator-test",
        referenceCode: "reference-test",
        endUserId: "+263771234567",
        amount: "12.50",
        currency: "USD",
      });
    });
  });

  describe("successful payment initiation", () => {
    it("accepts a customer payment request", async () => {
      const response = await callHandler(
        createRequest({ phoneNumber: "0771234567" }),
        createDependencies(),
      );

      assert.strictEqual(response.status, 202);

      const body = await getJson(response);
      const paymentAttempt = body.payment_attempt as Record<string, unknown>;

      assert.strictEqual(paymentAttempt.amount, 12.5);
      assert.strictEqual(paymentAttempt.currency, "USD");
    });
  });
});
