import * as mocha from "mocha";
import assert from "node:assert";

import {
  MAX_COUNTEROFFER_MESSAGE_LENGTH,
  MAX_COUNTEROFFER_TOTAL,
  validateCustomerCounteroffer,
  type ValidatedCustomerCounteroffer,
} from "../lib/validate-customer-counteroffer";

const { describe, it } = mocha;

const OFFER_ID = "11111111-1111-4111-8111-111111111111";

function createValidInput(overrides: Record<string, unknown> = {}) {
  return {
    offer_id: OFFER_ID,
    proposed_total: 8.5,
    message: "Could you consider this price?",
    ...overrides,
  };
}

function getValue(
  result: ReturnType<typeof validateCustomerCounteroffer>,
): ValidatedCustomerCounteroffer {
  if (result.ok) {
    return result.value;
  }

  throw new Error("Expected a valid customer counteroffer.");
}

describe("validateCustomerCounteroffer", () => {
  it("accepts a valid counteroffer", () => {
    const value = getValue(
      validateCustomerCounteroffer(createValidInput()),
    );

    assert.strictEqual(value.offer_id, OFFER_ID);
    assert.strictEqual(value.proposed_total, 8.5);
    assert.strictEqual(value.message, "Could you consider this price?");
  });

  it("accepts an amount with two decimal places", () => {
    const value = getValue(
      validateCustomerCounteroffer(
        createValidInput({ proposed_total: 8.55 }),
      ),
    );

    assert.strictEqual(value.proposed_total, 8.55);
  });

  it("accepts the maximum permitted amount", () => {
    const value = getValue(
      validateCustomerCounteroffer(
        createValidInput({
          proposed_total: MAX_COUNTEROFFER_TOTAL,
        }),
      ),
    );

    assert.strictEqual(value.proposed_total, MAX_COUNTEROFFER_TOTAL);
  });

  it("trims the counteroffer message", () => {
    const value = getValue(
      validateCustomerCounteroffer(
        createValidInput({ message: "  My proposed price.  " }),
      ),
    );

    assert.strictEqual(value.message, "My proposed price.");
  });

  it("normalizes an empty message to null", () => {
    const value = getValue(
      validateCustomerCounteroffer(
        createValidInput({ message: "   " }),
      ),
    );

    assert.strictEqual(value.message, null);
  });

  it("accepts a missing message", () => {
    const input = createValidInput();
    delete (input as { message?: string }).message;

    assert.strictEqual(
      getValue(validateCustomerCounteroffer(input)).message,
      null,
    );
  });

  it("accepts a null message", () => {
    const value = getValue(
      validateCustomerCounteroffer(
        createValidInput({ message: null }),
      ),
    );

    assert.strictEqual(value.message, null);
  });

  it("accepts a message at the maximum length", () => {
    const message = "a".repeat(MAX_COUNTEROFFER_MESSAGE_LENGTH);

    const value = getValue(
      validateCustomerCounteroffer(
        createValidInput({ message }),
      ),
    );

    assert.strictEqual(value.message?.length, 1000);
  });

  it("rejects a message exceeding the maximum length", () => {
    const result = validateCustomerCounteroffer(
      createValidInput({
        message: "a".repeat(MAX_COUNTEROFFER_MESSAGE_LENGTH + 1),
      }),
    );

    assert.strictEqual(result.ok, false);
  });

  it("rejects a non-object input", () => {
    assert.strictEqual(
      validateCustomerCounteroffer("invalid").ok,
      false,
    );
  });

  it("rejects null input", () => {
    assert.strictEqual(
      validateCustomerCounteroffer(null).ok,
      false,
    );
  });

  it("rejects an array as the top-level input", () => {
    assert.strictEqual(
      validateCustomerCounteroffer([]).ok,
      false,
    );
  });

  it("rejects an invalid offer ID", () => {
    assert.strictEqual(
      validateCustomerCounteroffer(
        createValidInput({ offer_id: "not-a-uuid" }),
      ).ok,
      false,
    );
  });

  it("rejects a missing offer ID", () => {
    const input = createValidInput();
    delete (input as { offer_id?: string }).offer_id;

    assert.strictEqual(
      validateCustomerCounteroffer(input).ok,
      false,
    );
  });

  it("rejects a numeric string as the proposed amount", () => {
    assert.strictEqual(
      validateCustomerCounteroffer(
        createValidInput({ proposed_total: "8.50" }),
      ).ok,
      false,
    );
  });

  it("rejects zero and negative amounts", () => {
    for (const amount of [0, -1]) {
      assert.strictEqual(
        validateCustomerCounteroffer(
          createValidInput({ proposed_total: amount }),
        ).ok,
        false,
      );
    }
  });

  it("rejects an amount with more than two decimal places", () => {
    assert.strictEqual(
      validateCustomerCounteroffer(
        createValidInput({ proposed_total: 8.555 }),
      ).ok,
      false,
    );
  });

  it("rejects an amount above the maximum", () => {
    assert.strictEqual(
      validateCustomerCounteroffer(
        createValidInput({
          proposed_total: MAX_COUNTEROFFER_TOTAL + 0.01,
        }),
      ).ok,
      false,
    );
  });

  it("rejects a non-finite amount", () => {
    for (const amount of [NaN, Infinity, -Infinity]) {
      assert.strictEqual(
        validateCustomerCounteroffer(
          createValidInput({ proposed_total: amount }),
        ).ok,
        false,
      );
    }
  });

  it("rejects a non-string message", () => {
    assert.strictEqual(
      validateCustomerCounteroffer(
        createValidInput({ message: 123 }),
      ).ok,
      false,
    );
  });
});