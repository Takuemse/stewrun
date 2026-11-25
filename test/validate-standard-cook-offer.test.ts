
import * as mocha from "mocha";
import assert from "node:assert";

import { validateStandardCookOffer } from "../lib/validate-standard-cook-offer";

const { describe, it } = mocha;

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

function createValidInput(overrides: Record<string, unknown> = {}) {
  return {
    request_id: REQUEST_ID,
    message: "Freshly prepared meals.",
    items: [
      {
        name: "Chicken and rice",
        description: "Grilled chicken served with rice.",
        quantity: 2,
        unit_price: 5.5,
      },
      {
        name: "Beef and vegetables",
        description: "Beef stew served with vegetables.",
        quantity: 1,
        unit_price: 7.25,
      },
    ],
    ...overrides,
  };
}

describe("validateStandardCookOffer", () => {
  it("accepts a valid standard offer with multiple meals", () => {
    const result = validateStandardCookOffer(createValidInput());

    assert.strictEqual(result.ok, true);

    if (!result.ok) return;

    assert.strictEqual(result.value.request_id, REQUEST_ID);
    assert.strictEqual(result.value.items.length, 2);
    assert.strictEqual(result.value.items[0].name, "Chicken and rice");
    assert.strictEqual(result.value.items[0].quantity, 2);
    assert.strictEqual(result.value.items[0].unit_price, 5.5);
    assert.strictEqual(result.value.items[1].name, "Beef and vegetables");
    assert.strictEqual(result.value.is_alternative, false);
  });

  it("rejects a non-object input", () => {
    for (const input of [null, undefined, [], "offer", 123]) {
      assert.strictEqual(validateStandardCookOffer(input).ok, false);
    }
  });

  it("rejects missing or empty meal items", () => {
    assert.strictEqual(
      validateStandardCookOffer({ request_id: REQUEST_ID }).ok,
      false,
    );

    assert.strictEqual(
      validateStandardCookOffer(createValidInput({ items: [] })).ok,
      false,
    );
  });

  it("rejects more than 20 meal lines", () => {
    const items = Array.from({ length: 21 }, (_, index) => ({
      name: `Meal ${index + 1}`,
      description: "A complete meal.",
      quantity: 1,
      unit_price: 5,
    }));

    assert.strictEqual(
      validateStandardCookOffer(createValidInput({ items })).ok,
      false,
    );
  });

  it("accepts exactly 20 meal lines", () => {
    const items = Array.from({ length: 20 }, (_, index) => ({
      name: `Meal ${index + 1}`,
      description: "A complete meal.",
      quantity: 1,
      unit_price: 5,
    }));

    const result = validateStandardCookOffer(createValidInput({ items }));

    assert.strictEqual(result.ok, true);

    if (result.ok) {
      assert.strictEqual(result.value.items.length, 20);
    }
  });

  it("rejects a non-object meal entry", () => {
    assert.strictEqual(
      validateStandardCookOffer(
        createValidInput({ items: [null] }),
      ).ok,
      false,
    );
  });

  it("rejects an invalid request ID", () => {
    assert.strictEqual(
      validateStandardCookOffer(
        createValidInput({ request_id: "invalid-id" }),
      ).ok,
      false,
    );
  });

  it("rejects a meal without a name", () => {
    const items = [
      {
        description: "A complete meal.",
        quantity: 1,
        unit_price: 5,
      },
    ];

    assert.strictEqual(
      validateStandardCookOffer(createValidInput({ items })).ok,
      false,
    );
  });

  it("rejects a meal without a description", () => {
    const items = [
      {
        name: "Chicken and rice",
        quantity: 1,
        unit_price: 5,
      },
    ];

    assert.strictEqual(
      validateStandardCookOffer(createValidInput({ items })).ok,
      false,
    );
  });

  it("rejects a description containing only whitespace", () => {
    const items = [
      {
        name: "Chicken and rice",
        description: "   ",
        quantity: 1,
        unit_price: 5,
      },
    ];

    assert.strictEqual(
      validateStandardCookOffer(createValidInput({ items })).ok,
      false,
    );
  });

  it("rejects zero, negative and fractional quantities", () => {
    for (const quantity of [0, -1, 1.5, 21]) {
      const items = [
        {
          name: "Chicken and rice",
          description: "A complete meal.",
          quantity,
          unit_price: 5,
        },
      ];

      assert.strictEqual(
        validateStandardCookOffer(createValidInput({ items })).ok,
        false,
      );
    }
  });

  it("accepts the maximum quantity of 20", () => {
    const items = [
      {
        name: "Chicken and rice",
        description: "A complete meal.",
        quantity: 20,
        unit_price: 5,
      },
    ];

    assert.strictEqual(
      validateStandardCookOffer(createValidInput({ items })).ok,
      true,
    );
  });

  it("rejects zero, negative and non-numeric prices", () => {
    for (const unit_price of [0, -5, "5", NaN, Infinity]) {
      const items = [
        {
          name: "Chicken and rice",
          description: "A complete meal.",
          quantity: 1,
          unit_price,
        },
      ];

      assert.strictEqual(
        validateStandardCookOffer(createValidInput({ items })).ok,
        false,
      );
    }
  });

  it("rejects prices with more than two decimal places", () => {
    const items = [
      {
        name: "Chicken and rice",
        description: "A complete meal.",
        quantity: 1,
        unit_price: 5.555,
      },
    ];

    assert.strictEqual(
      validateStandardCookOffer(createValidInput({ items })).ok,
      false,
    );
  });

  it("accepts a price with two decimal places", () => {
    const items = [
      {
        name: "Chicken and rice",
        description: "A complete meal.",
        quantity: 1,
        unit_price: 5.55,
      },
    ];

    assert.strictEqual(
      validateStandardCookOffer(createValidInput({ items })).ok,
      true,
    );
  });

  it("rejects a total exceeding the permitted offer limit", () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      name: `Meal ${index + 1}`,
      description: "A complete meal.",
      quantity: 20,
      unit_price: 4_999_999.99,
    }));

    assert.strictEqual(
      validateStandardCookOffer(createValidInput({ items })).ok,
      false,
    );
  });

  it("trims the offer message", () => {
    const result = validateStandardCookOffer(
      createValidInput({ message: "  Freshly prepared.  " }),
    );

    assert.strictEqual(result.ok, true);

    if (result.ok) {
      assert.strictEqual(result.value.message, "Freshly prepared.");
    }
  });

  it("normalizes an empty message to null", () => {
    const result = validateStandardCookOffer(
      createValidInput({ message: "   " }),
    );

    assert.strictEqual(result.ok, true);

    if (result.ok) {
      assert.strictEqual(result.value.message, null);
    }
  });

  it("rejects a non-string message", () => {
    assert.strictEqual(
      validateStandardCookOffer(
        createValidInput({ message: 123 }),
      ).ok,
      false,
    );
  });

  it("rejects a message exceeding 1000 characters", () => {
    assert.strictEqual(
      validateStandardCookOffer(
        createValidInput({ message: "a".repeat(1001) }),
      ).ok,
      false,
    );
  });

  it("forces standard offers to remain non-alternative", () => {
    const result = validateStandardCookOffer(
      createValidInput({ is_alternative: true }),
    );

    assert.strictEqual(result.ok, true);

    if (result.ok) {
      assert.strictEqual(result.value.is_alternative, false);
    }
  });
});
