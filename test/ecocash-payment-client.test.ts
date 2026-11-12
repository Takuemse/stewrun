
import * as mocha from "mocha";
import assert from "node:assert";

import {
  EcoCashPaymentError,
  initiateEcoCashPayment,
  normalizeZimbabweEcoCashPhoneNumber,
} from "../lib/ecocash-payment-client";

const { describe, it, afterEach } = mocha;

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("normalizeZimbabweEcoCashPhoneNumber", () => {
  it("normalizes a local Zimbabwean mobile number", () => {
    assert.strictEqual(
      normalizeZimbabweEcoCashPhoneNumber("077 123 4567"),
      "+263771234567",
    );
  });

  it("accepts an international number with formatting", () => {
    assert.strictEqual(
      normalizeZimbabweEcoCashPhoneNumber("+263 (77) 123-4567"),
      "+263771234567",
    );
  });

  it("rejects non-Zimbabwean, landline, and malformed numbers", () => {
    assert.strictEqual(
      normalizeZimbabweEcoCashPhoneNumber("+1 202 555 0100"),
      null,
    );
    assert.strictEqual(
      normalizeZimbabweEcoCashPhoneNumber("024 200 0000"),
      null,
    );
    assert.strictEqual(
      normalizeZimbabweEcoCashPhoneNumber("077 123"),
      null,
    );
  });
});

describe("initiateEcoCashPayment", () => {
  it("sends the payment request and accepts a valid response", async () => {
    let capturedUrl: RequestInfo | URL | undefined;
    let capturedOptions: RequestInit | undefined;

    globalThis.fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      capturedUrl = input;
      capturedOptions = init;

      return new Response(
        JSON.stringify({
          payment_attempt: {
            amount: "12.5",
            currency: "USD",
          },
        }),
        {
          status: 202,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    };

    const result = await initiateEcoCashPayment(
      "order-123",
      "+263771234567",
    );

    assert.deepStrictEqual(result, {
      amount: "12.50",
      currency: "USD",
    });

    assert.strictEqual(
      capturedUrl,
      "/api/orders/order-123/payment",
    );
    assert.strictEqual(capturedOptions?.method, "POST");

    assert.deepStrictEqual(
      JSON.parse(capturedOptions?.body as string),
      {
        phoneNumber: "+263771234567",
      },
    );
  });

  it("treats a network failure as an uncertain payment outcome", async () => {
    globalThis.fetch = async (): Promise<Response> => {
      throw new Error("Network connection lost");
    };

    await assert.rejects(
      initiateEcoCashPayment("order-123", "+263771234567"),
      (error: unknown) =>
        error instanceof EcoCashPaymentError &&
        error.requiresReconciliation === true,
    );
  });

  it("treats an unreadable response as an uncertain outcome", async () => {
    globalThis.fetch = async (): Promise<Response> =>
      new Response("Invalid JSON", {
        status: 202,
      });

    await assert.rejects(
      initiateEcoCashPayment("order-123", "+263771234567"),
      (error: unknown) =>
        error instanceof EcoCashPaymentError &&
        error.requiresReconciliation === true,
    );
  });

  it("treats PAYMENT_STATUS_UNCERTAIN as requiring reconciliation", async () => {
    globalThis.fetch = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          error: "Payment status could not be confirmed.",
          code: "PAYMENT_STATUS_UNCERTAIN",
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

    await assert.rejects(
      initiateEcoCashPayment("order-123", "+263771234567"),
      (error: unknown) =>
        error instanceof EcoCashPaymentError &&
        error.requiresReconciliation === true,
    );
  });

  it("treats a definite server rejection as a normal failure", async () => {
    globalThis.fetch = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          error: "Invalid EcoCash phone number.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

    await assert.rejects(
      initiateEcoCashPayment("order-123", "+263771234567"),
      (error: unknown) =>
        error instanceof EcoCashPaymentError &&
        error.requiresReconciliation === false &&
        error.message === "Invalid EcoCash phone number.",
    );
  });

  it("treats a malformed successful response as uncertain", async () => {
    globalThis.fetch = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          unexpected: true,
        }),
        {
          status: 202,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

    await assert.rejects(
      initiateEcoCashPayment("order-123", "+263771234567"),
      (error: unknown) =>
        error instanceof EcoCashPaymentError &&
        error.requiresReconciliation === true,
    );
  });

  it("treats invalid payment details in a successful response as uncertain", async () => {
    globalThis.fetch = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          payment_attempt: {
            amount: "0",
            currency: "USD",
          },
        }),
        {
          status: 202,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

    await assert.rejects(
      initiateEcoCashPayment("order-123", "+263771234567"),
      (error: unknown) =>
        error instanceof EcoCashPaymentError &&
        error.requiresReconciliation === true,
    );
  });
});
