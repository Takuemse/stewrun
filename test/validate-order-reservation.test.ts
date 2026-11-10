import * as mocha from "mocha";
import assert from "node:assert";

import {
  validateOrderReservation,
  type ValidatedOrderReservation,
} from "../lib/validate-order-reservation";

const { describe, it } = mocha;

const OFFER_ID = "11111111-1111-4111-8111-111111111111";

function createValidInput(overrides: Record<string, unknown> = {}) {
  return {
    offer_id: OFFER_ID,
    ...overrides,
  };
}

function getValue(
  result: ReturnType<typeof validateOrderReservation>,
): ValidatedOrderReservation {
  if (result.ok) {
    return result.value;
  }

  throw new Error("Expected valid reservation data.");
}

describe("validateOrderReservation", () => {
  it("accepts a valid offer ID", () => {
    const value = getValue(
      validateOrderReservation(createValidInput()),
    );

    assert.strictEqual(value.offer_id, OFFER_ID);
  });

  it("accepts an uppercase UUID", () => {
    const uppercaseId = OFFER_ID.toUpperCase();

    const value = getValue(
      validateOrderReservation(
        createValidInput({ offer_id: uppercaseId }),
      ),
    );

    assert.strictEqual(value.offer_id, uppercaseId);
  });

  it("rejects a non-object input", () => {
    assert.strictEqual(
      validateOrderReservation("invalid").ok,
      false,
    );
  });

  it("rejects null input", () => {
    assert.strictEqual(
      validateOrderReservation(null).ok,
      false,
    );
  });

  it("rejects an array input", () => {
    assert.strictEqual(
      validateOrderReservation([]).ok,
      false,
    );
  });

  it("rejects an invalid offer ID", () => {
    assert.strictEqual(
      validateOrderReservation(
        createValidInput({ offer_id: "not-a-uuid" }),
      ).ok,
      false,
    );
  });

  it("rejects a missing offer ID", () => {
    const input = createValidInput();
    delete (input as { offer_id?: string }).offer_id;

    assert.strictEqual(
      validateOrderReservation(input).ok,
      false,
    );
  });

  it("rejects a numeric offer ID", () => {
    assert.strictEqual(
      validateOrderReservation(
        createValidInput({ offer_id: 123 }),
      ).ok,
      false,
    );
  });

  it("rejects an empty offer ID", () => {
    assert.strictEqual(
      validateOrderReservation(
        createValidInput({ offer_id: "" }),
      ).ok,
      false,
    );
  });

  it("does not accept a client-supplied price as reservation data", () => {
    const result = validateOrderReservation({
      offer_id: OFFER_ID,
      amount_due: 1,
    });

    assert.strictEqual(result.ok, true);

    if (result.ok) {
      assert.deepStrictEqual(result.value, {
        offer_id: OFFER_ID,
      });
    }
  });
});
