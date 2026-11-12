
import * as mocha from "mocha";
import assert from "node:assert";

import {
  initiateEcoCashCharge,
  lookupEcoCashCharge,
  type EcoCashChargeInput,
} from "../lib/server/ecocash-provider.server";

const { describe, it, beforeEach, afterEach } = mocha;

const envValues: Record<string, string> = {
  ECOCASH_BASE_URL: "https://sandbox.example.test/payment/v1",
  ECOCASH_BASIC_AUTH_USERNAME: "test-user",
  ECOCASH_BASIC_AUTH_PASSWORD: "test-password",
  ECOCASH_MERCHANT_CODE: "test-merchant",
  ECOCASH_MERCHANT_PIN: "1234",
  ECOCASH_MERCHANT_NUMBER: "123456789",
  ECOCASH_COUNTRY_CODE: "ZW",
  ECOCASH_TERMINAL_ID: "TEST001",
  ECOCASH_LOCATION: "Harare",
  ECOCASH_SUPER_MERCHANT_NAME: "Test Merchant",
  ECOCASH_MERCHANT_NAME: "StewRun Test",
};

const envKeys = Object.keys(envValues);
const originalEnv: Record<string, string | undefined> = {};

const validInput: EcoCashChargeInput = {
  clientCorrelator: "test-correlator-001",
  referenceCode: "STW-TEST-001",
  endUserId: "+263771234567",
  amount: "12.50",
  currency: "USD",
};

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    clientCorrelator: validInput.clientCorrelator,
    referenceCode: validInput.referenceCode,
    endUserId: "771234567",
    responseCode: "00",
    transactionOperationStatus: "Charged",
    ecocashReference: "ECO-TEST-001",
    ...overrides,
  };
}

function createMockFetch(body: string, status = 200) {
  let calls = 0;
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;

  const fetchImpl: typeof fetch = async (input, init) => {
    calls += 1;
    capturedUrl = String(input);
    capturedInit = init;

    return new Response(body, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  return {
    fetchImpl,
    getCalls: () => calls,
    getUrl: () => capturedUrl,
    getInit: () => capturedInit,
  };
}

describe("EcoCash provider", () => {
  beforeEach(() => {
    for (const key of envKeys) {
      originalEnv[key] = process.env[key];
      process.env[key] = envValues[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const originalValue = originalEnv[key];

      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
  });

  describe("lookupEcoCashCharge", () => {
    const lookupInput = {
      clientCorrelator: validInput.clientCorrelator,
      referenceCode: validInput.referenceCode,
      endUserId: validInput.endUserId,
    };

    it("verifies a matching successful Charged transaction", async () => {
      const mock = createMockFetch(JSON.stringify(validPayload()));

      const result = await lookupEcoCashCharge(
        lookupInput,
        mock.fetchImpl,
      );

      assert.deepStrictEqual(result, {
        outcome: "verified_success",
        providerStatus: "Charged",
        responseCode: "00",
        providerReference: "ECO-TEST-001",
      });
    });

    it("uses the correct lookup URL, GET method and Basic Auth", async () => {
      const mock = createMockFetch(JSON.stringify(validPayload()));

      await lookupEcoCashCharge(lookupInput, mock.fetchImpl);

      assert.strictEqual(
        mock.getUrl(),
        "https://sandbox.example.test/payment/v1/771234567/transactions/amount/test-correlator-001",
      );

      const init = mock.getInit();

      assert.strictEqual(init?.method, "GET");
      assert.strictEqual(init?.cache, "no-store");
      assert.strictEqual(init?.body, undefined);

      assert.strictEqual(
        new Headers(init?.headers).get("Authorization"),
        `Basic ${Buffer.from("test-user:test-password").toString("base64")}`,
      );
    });

    it("returns uncertain when transaction identifiers do not match", async () => {
      const mismatches = [
        { clientCorrelator: "different-correlator" },
        { referenceCode: "different-reference" },
        { endUserId: "772222222" },
      ];

      for (const mismatch of mismatches) {
        const mock = createMockFetch(
          JSON.stringify(validPayload(mismatch)),
        );

        const result = await lookupEcoCashCharge(
          lookupInput,
          mock.fetchImpl,
        );

        assert.strictEqual(result.outcome, "uncertain");
      }
    });

    it("returns uncertain when the response code is not successful", async () => {
      const mock = createMockFetch(
        JSON.stringify(validPayload({ responseCode: "99" })),
      );

      const result = await lookupEcoCashCharge(
        lookupInput,
        mock.fetchImpl,
      );

      assert.strictEqual(result.outcome, "uncertain");
    });

    it("returns uncertain when the transaction is not Charged", async () => {
      const mock = createMockFetch(
        JSON.stringify(
          validPayload({ transactionOperationStatus: "Failed" }),
        ),
      );

      const result = await lookupEcoCashCharge(
        lookupInput,
        mock.fetchImpl,
      );

      assert.strictEqual(result.outcome, "uncertain");
    });

    it("returns uncertain for unsuccessful HTTP responses", async () => {
      const mock = createMockFetch(
        JSON.stringify({ message: "Not found" }),
        404,
      );

      const result = await lookupEcoCashCharge(
        lookupInput,
        mock.fetchImpl,
      );

      assert.strictEqual(result.outcome, "uncertain");
    });

    it("returns uncertain for malformed JSON", async () => {
      const mock = createMockFetch("not valid JSON");

      const result = await lookupEcoCashCharge(
        lookupInput,
        mock.fetchImpl,
      );

      assert.strictEqual(result.outcome, "uncertain");
    });

    it("returns uncertain when the network request throws", async () => {
      const fetchImpl: typeof fetch = async () => {
        throw new Error("Simulated network failure");
      };

      const result = await lookupEcoCashCharge(
        lookupInput,
        fetchImpl,
      );

      assert.strictEqual(result.outcome, "uncertain");
    });

    it("rejects invalid phone numbers before making a request", async () => {
      const mock = createMockFetch(JSON.stringify(validPayload()));

      await assert.rejects(
        () =>
          lookupEcoCashCharge(
            { ...lookupInput, endUserId: "+263123456789" },
            mock.fetchImpl,
          ),
        /Invalid EcoCash customer number/,
      );

      assert.strictEqual(mock.getCalls(), 0);
    });
  });

  describe("initiateEcoCashCharge", () => {
    it("acknowledges a fully verified Charged response", async () => {
      const mock = createMockFetch(JSON.stringify(validPayload()));

      const result = await initiateEcoCashCharge(
        validInput,
        mock.fetchImpl,
      );

      assert.deepStrictEqual(result, {
        outcome: "acknowledged",
        providerStatus: "Charged",
        responseCode: "00",
        providerReference: "ECO-TEST-001",
      });
    });

    it("sends the expected URL, authentication and payment body", async () => {
      const mock = createMockFetch(JSON.stringify(validPayload()));

      await initiateEcoCashCharge(validInput, mock.fetchImpl);

      assert.strictEqual(
        mock.getUrl(),
        "https://sandbox.example.test/payment/v1/transactions/amount/",
      );

      const init = mock.getInit();

      assert.strictEqual(init?.method, "POST");
      assert.strictEqual(init?.cache, "no-store");

      assert.strictEqual(
        new Headers(init?.headers).get("Authorization"),
        `Basic ${Buffer.from("test-user:test-password").toString("base64")}`,
      );

      const body = JSON.parse(String(init?.body));

      assert.strictEqual(body.clientCorrelator, validInput.clientCorrelator);
      assert.strictEqual(body.referenceCode, validInput.referenceCode);
      assert.strictEqual(body.endUserId, "771234567");
      assert.strictEqual(body.tranType, "MER");

      assert.strictEqual(
        body.paymentAmount.charginginformation.amount,
        12.5,
      );

      assert.strictEqual(
        body.paymentAmount.charginginformation.currency,
        "USD",
      );
    });

    it("returns uncertain when the provider response code is not successful", async () => {
      const mock = createMockFetch(
        JSON.stringify(validPayload({ responseCode: "99" })),
      );

      const result = await initiateEcoCashCharge(
        validInput,
        mock.fetchImpl,
      );

      assert.strictEqual(result.outcome, "uncertain");
    });

    it("returns uncertain when the transaction status is not Charged", async () => {
      const mock = createMockFetch(
        JSON.stringify(
          validPayload({ transactionOperationStatus: "Failed" }),
        ),
      );

      const result = await initiateEcoCashCharge(
        validInput,
        mock.fetchImpl,
      );

      assert.strictEqual(result.outcome, "uncertain");
    });

    it("returns uncertain when response identifiers do not match", async () => {
      const mismatches = [
        { clientCorrelator: "different-correlator" },
        { referenceCode: "different-reference" },
        { endUserId: "772222222" },
      ];

      for (const mismatch of mismatches) {
        const mock = createMockFetch(
          JSON.stringify(validPayload(mismatch)),
        );

        const result = await initiateEcoCashCharge(
          validInput,
          mock.fetchImpl,
        );

        assert.strictEqual(result.outcome, "uncertain");
      }
    });

    it("returns uncertain when the provider response is malformed JSON", async () => {
      const mock = createMockFetch("not valid JSON");

      const result = await initiateEcoCashCharge(
        validInput,
        mock.fetchImpl,
      );

      assert.strictEqual(result.outcome, "uncertain");
    });

    it("returns uncertain when the provider response is not an object", async () => {
      const mock = createMockFetch(JSON.stringify(["invalid"]));

      const result = await initiateEcoCashCharge(
        validInput,
        mock.fetchImpl,
      );

      assert.strictEqual(result.outcome, "uncertain");
    });

    it("returns uncertain for an unsuccessful HTTP response", async () => {
      const mock = createMockFetch(
        JSON.stringify({ message: "Rejected" }),
        422,
      );

      const result = await initiateEcoCashCharge(
        validInput,
        mock.fetchImpl,
      );

      assert.strictEqual(result.outcome, "uncertain");
    });

    it("returns uncertain when the network request throws", async () => {
      const fetchImpl: typeof fetch = async () => {
        throw new Error("Simulated network failure");
      };

      const result = await initiateEcoCashCharge(
        validInput,
        fetchImpl,
      );

      assert.strictEqual(result.outcome, "uncertain");
    });

    it("rejects invalid payment amounts before making a request", async () => {
      const mock = createMockFetch(JSON.stringify(validPayload()));

      await assert.rejects(
        () =>
          initiateEcoCashCharge(
            { ...validInput, amount: "0" },
            mock.fetchImpl,
          ),
        /Invalid EcoCash payment amount/,
      );

      assert.strictEqual(mock.getCalls(), 0);
    });

    it("rejects unsupported currencies before making a request", async () => {
      const mock = createMockFetch(JSON.stringify(validPayload()));

      await assert.rejects(
        () =>
          initiateEcoCashCharge(
            { ...validInput, currency: "ZWL" },
            mock.fetchImpl,
          ),
        /Unsupported EcoCash payment currency/,
      );

      assert.strictEqual(mock.getCalls(), 0);
    });

    it("rejects invalid customer phone numbers before making a request", async () => {
      const mock = createMockFetch(JSON.stringify(validPayload()));

      await assert.rejects(
        () =>
          initiateEcoCashCharge(
            { ...validInput, endUserId: "+263123456789" },
            mock.fetchImpl,
          ),
        /Invalid EcoCash customer number/,
      );

      assert.strictEqual(mock.getCalls(), 0);
    });
  });
});
