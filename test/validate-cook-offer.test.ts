import * as mocha from "mocha";
import assert from "node:assert";

import {
  MAX_OFFER_ITEMS,
  MAX_OFFER_ITEM_NAME_LENGTH,
  MAX_OFFER_DESCRIPTION_LENGTH,
  MAX_OFFER_MESSAGE_LENGTH,
  validateCookOffer,
  type ValidatedCookOffer,
} from "../lib/validate-cook-offer";

const { describe, it } = mocha;

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const MENU_ITEM_ID = "22222222-2222-4222-8222-222222222222";

function createValidInput(
  overrides: Record<string, unknown> = {},
) {
  return {
    request_id: REQUEST_ID,
    message: "Freshly prepared meal.",
    items: [
      {
        name: "Chicken and rice",
        description: "Grilled chicken with rice.",
        quantity: 2,
        unit_price: 5.5,
      },
    ],
    ...overrides,
  };
}

function getValue(
  result: ReturnType<typeof validateCookOffer>,
): ValidatedCookOffer {
  if (result.ok) {
    return result.value;
  }

  throw new Error("Expected a valid cook offer.");
}
describe("validateCookOffer", () => {
  it("accepts a valid custom meal offer", () => {
    const result = validateCookOffer(createValidInput());
    const value = getValue(result);

    assert.strictEqual(value.request_id, REQUEST_ID);
    assert.strictEqual(value.items.length, 1);
    assert.strictEqual(value.items[0].name, "Chicken and rice");
    assert.strictEqual(value.items[0].quantity, 2);
    assert.strictEqual(value.items[0].unit_price, 5.5);
  });

  it("trims the offer message", () => {
    const result = validateCookOffer(
      createValidInput({ message: "  Thank you.  " }),
    );

    assert.strictEqual(getValue(result).message, "Thank you.");
  });

  it("normalizes an empty message to null", () => {
    const result = validateCookOffer(
      createValidInput({ message: "   " }),
    );

    assert.strictEqual(getValue(result).message, null);
  });

  it("accepts a missing message", () => {
    const input = createValidInput();
    delete (input as Record<string, unknown>).message;

    assert.strictEqual(
      getValue(validateCookOffer(input)).message,
      null,
    );
  });

  it("rejects a non-object input", () => {
    assert.strictEqual(
      validateCookOffer("invalid").ok,
      false,
    );
  });

  it("rejects null input", () => {
    assert.strictEqual(
      validateCookOffer(null).ok,
      false,
    );
  });

  it("rejects an array as the top-level input", () => {
    assert.strictEqual(
      validateCookOffer([]).ok,
      false,
    );
  });

  it("rejects an invalid request ID", () => {
    const result = validateCookOffer(
      createValidInput({ request_id: "not-a-uuid" }),
    );

    assert.strictEqual(result.ok, false);
  });

  it("rejects a missing request ID", () => {
    const input = createValidInput();
    delete (input as Record<string, unknown>).request_id;

    assert.strictEqual(validateCookOffer(input).ok, false);
  });

  it("rejects a non-string message", () => {
    const result = validateCookOffer(
      createValidInput({ message: 123 }),
    );

    assert.strictEqual(result.ok, false);
  });

  it("accepts a message at the maximum length", () => {
    const message = "A".repeat(MAX_OFFER_MESSAGE_LENGTH);

    const result = validateCookOffer(
      createValidInput({ message }),
    );

    assert.strictEqual(getValue(result).message?.length, 1000);
  });

  it("rejects a message longer than the maximum length", () => {
    const message = "A".repeat(MAX_OFFER_MESSAGE_LENGTH + 1);

    assert.strictEqual(
      validateCookOffer(createValidInput({ message })).ok,
      false,
    );
  });

  it("rejects missing offer items", () => {
    const input = createValidInput();
    delete (input as Record<string, unknown>).items;

    assert.strictEqual(validateCookOffer(input).ok, false);
  });

  it("rejects an empty offer", () => {
    const result = validateCookOffer(
      createValidInput({ items: [] }),
    );

    assert.strictEqual(result.ok, false);
  });

  it("accepts exactly 20 offer items", () => {
    const items = Array.from(
      { length: MAX_OFFER_ITEMS },
      (_, index) => ({
        name: `Meal ${index + 1}`,
        quantity: 1,
        unit_price: 2,
      }),
    );

    const result = validateCookOffer(
      createValidInput({ items }),
    );

    assert.strictEqual(getValue(result).items.length, 20);
  });

  it("rejects more than 20 offer items", () => {
    const items = Array.from(
      { length: MAX_OFFER_ITEMS + 1 },
      (_, index) => ({
        name: `Meal ${index + 1}`,
        quantity: 1,
        unit_price: 2,
      }),
    );

    assert.strictEqual(
      validateCookOffer(createValidInput({ items })).ok,
      false,
    );
  });

  it("rejects a non-object offer item", () => {
    const result = validateCookOffer(
      createValidInput({ items: ["Chicken"] }),
    );

    assert.strictEqual(result.ok, false);
  });

  it("rejects a custom meal without a name", () => {
    const result = validateCookOffer(
      createValidInput({
        items: [
          {
            quantity: 1,
            unit_price: 5,
          },
        ],
      }),
    );

    assert.strictEqual(result.ok, false);
  });

  it("trims custom meal names", () => {
    const result = validateCookOffer(
      createValidInput({
        items: [
          {
            name: "  Sadza  ",
            quantity: 1,
            unit_price: 2,
          },
        ],
      }),
    );

    assert.strictEqual(getValue(result).items[0].name, "Sadza");
  });

  it("accepts a custom meal name at the maximum length", () => {
    const name = "A".repeat(MAX_OFFER_ITEM_NAME_LENGTH);

    const result = validateCookOffer(
      createValidInput({
        items: [{ name, quantity: 1, unit_price: 2 }],
      }),
    );

    assert.strictEqual(
      getValue(result).items[0].name?.length,
      MAX_OFFER_ITEM_NAME_LENGTH,
    );
  });

  it("rejects a custom meal name longer than 150 characters", () => {
    const name = "A".repeat(MAX_OFFER_ITEM_NAME_LENGTH + 1);

    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [{ name, quantity: 1, unit_price: 2 }],
        }),
      ).ok,
      false,
    );
  });

  it("accepts an optional custom meal description", () => {
    const result = validateCookOffer(
      createValidInput({
        items: [
          {
            name: "Sadza",
            description: "  With vegetables  ",
            quantity: 1,
            unit_price: 2,
          },
        ],
      }),
    );

    assert.strictEqual(
      getValue(result).items[0].description,
      "With vegetables",
    );
  });

  it("accepts a description at the maximum length", () => {
    const description = "A".repeat(
      MAX_OFFER_DESCRIPTION_LENGTH,
    );

    const result = validateCookOffer(
      createValidInput({
        items: [
          {
            name: "Sadza",
            description,
            quantity: 1,
            unit_price: 2,
          },
        ],
      }),
    );

    assert.strictEqual(
      getValue(result).items[0].description?.length,
      MAX_OFFER_DESCRIPTION_LENGTH,
    );
  });

  it("rejects a description longer than 500 characters", () => {
    const description = "A".repeat(
      MAX_OFFER_DESCRIPTION_LENGTH + 1,
    );

    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [
            {
              name: "Sadza",
              description,
              quantity: 1,
              unit_price: 2,
            },
          ],
        }),
      ).ok,
      false,
    );
  });

  it("rejects a non-string description", () => {
    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [
            {
              name: "Sadza",
              description: 123,
              quantity: 1,
              unit_price: 2,
            },
          ],
        }),
      ).ok,
      false,
    );
  });

  it("accepts an existing menu item reference without a name", () => {
    const result = validateCookOffer(
      createValidInput({
        items: [
          {
            menu_item_id: MENU_ITEM_ID,
            quantity: 2,
            unit_price: 4.5,
          },
        ],
      }),
    );

    const item = getValue(result).items[0];

    assert.strictEqual(item.menu_item_id, MENU_ITEM_ID);
    assert.strictEqual(item.name, undefined);
  });

  it("rejects an invalid menu item UUID", () => {
    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [
            {
              menu_item_id: "invalid",
              quantity: 1,
              unit_price: 2,
            },
          ],
        }),
      ).ok,
      false,
    );
  });

  it("accepts a null menu item reference for a custom meal", () => {
    const result = validateCookOffer(
      createValidInput({
        items: [
          {
            menu_item_id: null,
            name: "Sadza",
            quantity: 1,
            unit_price: 2,
          },
        ],
      }),
    );

    assert.strictEqual(
      getValue(result).items[0].menu_item_id,
      null,
    );
  });

  it("rejects a quantity of zero", () => {
    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [
            { name: "Sadza", quantity: 0, unit_price: 2 },
          ],
        }),
      ).ok,
      false,
    );
  });

  it("rejects a negative quantity", () => {
    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [
            { name: "Sadza", quantity: -1, unit_price: 2 },
          ],
        }),
      ).ok,
      false,
    );
  });

  it("rejects a fractional quantity", () => {
    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [
            { name: "Sadza", quantity: 1.5, unit_price: 2 },
          ],
        }),
      ).ok,
      false,
    );
  });

  it("rejects a quantity above 20", () => {
    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [
            { name: "Sadza", quantity: 21, unit_price: 2 },
          ],
        }),
      ).ok,
      false,
    );
  });

  it("accepts a quantity of 20", () => {
    const result = validateCookOffer(
      createValidInput({
        items: [
          { name: "Sadza", quantity: 20, unit_price: 2 },
        ],
      }),
    );

    assert.strictEqual(getValue(result).items[0].quantity, 20);
  });

  it("rejects a price of zero", () => {
    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [
            { name: "Sadza", quantity: 1, unit_price: 0 },
          ],
        }),
      ).ok,
      false,
    );
  });

  it("rejects a negative price", () => {
    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [
            { name: "Sadza", quantity: 1, unit_price: -2 },
          ],
        }),
      ).ok,
      false,
    );
  });

  it("rejects a price with more than two decimal places", () => {
    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [
            { name: "Sadza", quantity: 1, unit_price: 2.123 },
          ],
        }),
      ).ok,
      false,
    );
  });

  it("accepts a price with two decimal places", () => {
    const result = validateCookOffer(
      createValidInput({
        items: [
          { name: "Sadza", quantity: 1, unit_price: 2.25 },
        ],
      }),
    );

    assert.strictEqual(getValue(result).items[0].unit_price, 2.25);
  });

  it("rejects a non-numeric price", () => {
    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [
            { name: "Sadza", quantity: 1, unit_price: "2" },
          ],
        }),
      ).ok,
      false,
    );
  });

  it("rejects a total exceeding the database limit", () => {
    assert.strictEqual(
      validateCookOffer(
        createValidInput({
          items: [
            {
              name: "Sadza",
              quantity: 20,
              unit_price: 99_999_999.99,
            },
          ],
        }),
      ).ok,
      false,
    );
  });

  it("ignores client-supplied line totals", () => {
    const result = validateCookOffer(
      createValidInput({
        items: [
          {
            name: "Sadza",
            quantity: 2,
            unit_price: 3,
            line_total: 1,
          },
        ],
      }),
    );

    const item = getValue(result).items[0];

assert.strictEqual("line_total" in item, false);
  });
});