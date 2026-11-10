import * as mocha from "mocha";
import assert from "node:assert";

import {
  validateNegotiationResponse,
  type ValidatedNegotiationResponse,
} from "../lib/validate-negotiation-response";

const { describe, it } = mocha;

const NEGOTIATION_ID = "11111111-1111-4111-8111-111111111111";

function createValidInput(overrides: Record<string, unknown> = {}) {
  return {
    negotiation_id: NEGOTIATION_ID,
    decision: "accepted",
    ...overrides,
  };
}

function getValue(
  result: ReturnType<typeof validateNegotiationResponse>,
): ValidatedNegotiationResponse {
  if (result.ok) {
    return result.value;
  }

  throw new Error("Expected a valid negotiation response.");
}

describe("validateNegotiationResponse", () => {
  it("accepts an accepted decision", () => {
    const value = getValue(
      validateNegotiationResponse(createValidInput()),
    );

    assert.strictEqual(value.negotiation_id, NEGOTIATION_ID);
    assert.strictEqual(value.decision, "accepted");
  });

  it("accepts a rejected decision", () => {
    const value = getValue(
      validateNegotiationResponse(
        createValidInput({ decision: "rejected" }),
      ),
    );

    assert.strictEqual(value.decision, "rejected");
  });

  it("accepts an uppercase UUID", () => {
    const value = getValue(
      validateNegotiationResponse(
        createValidInput({
          negotiation_id: NEGOTIATION_ID.toUpperCase(),
        }),
      ),
    );

    assert.strictEqual(
      value.negotiation_id,
      NEGOTIATION_ID.toUpperCase(),
    );
  });

  it("rejects a non-object input", () => {
    assert.strictEqual(
      validateNegotiationResponse("invalid").ok,
      false,
    );
  });

  it("rejects null input", () => {
    assert.strictEqual(
      validateNegotiationResponse(null).ok,
      false,
    );
  });

  it("rejects an array as the top-level input", () => {
    assert.strictEqual(
      validateNegotiationResponse([]).ok,
      false,
    );
  });

  it("rejects an invalid negotiation ID", () => {
    assert.strictEqual(
      validateNegotiationResponse(
        createValidInput({ negotiation_id: "not-a-uuid" }),
      ).ok,
      false,
    );
  });

  it("rejects a missing negotiation ID", () => {
    const input = createValidInput();
    delete (input as { negotiation_id?: string }).negotiation_id;

    assert.strictEqual(
      validateNegotiationResponse(input).ok,
      false,
    );
  });

  it("rejects a numeric negotiation ID", () => {
    assert.strictEqual(
      validateNegotiationResponse(
        createValidInput({ negotiation_id: 123 }),
      ).ok,
      false,
    );
  });

  it("rejects an unsupported accept decision", () => {
    assert.strictEqual(
      validateNegotiationResponse(
        createValidInput({ decision: "accept" }),
      ).ok,
      false,
    );
  });

  it("rejects an unsupported reject decision", () => {
    assert.strictEqual(
      validateNegotiationResponse(
        createValidInput({ decision: "reject" }),
      ).ok,
      false,
    );
  });

  it("rejects a pending decision", () => {
    assert.strictEqual(
      validateNegotiationResponse(
        createValidInput({ decision: "pending" }),
      ).ok,
      false,
    );
  });

  it("rejects a missing decision", () => {
    const input = createValidInput();
    delete (input as { decision?: string }).decision;

    assert.strictEqual(
      validateNegotiationResponse(input).ok,
      false,
    );
  });

  it("rejects a non-string decision", () => {
    assert.strictEqual(
      validateNegotiationResponse(
        createValidInput({ decision: 123 }),
      ).ok,
      false,
    );
  });

  it("rejects an empty decision", () => {
    assert.strictEqual(
      validateNegotiationResponse(
        createValidInput({ decision: "" }),
      ).ok,
      false,
    );
  });
});
