
import * as mocha from "mocha";
import assert from "node:assert";
import {
  MAX_ITEM_NAME_LENGTH,
  MAX_MEAL_ITEMS,
  MAX_NOTES_LENGTH,
  validateParsedOrder,
  type ParsedOrderOutput,
} from "../lib/parse-order";

const { describe, it } = mocha;

function createValidInput(
  overrides: Record<string, unknown> = {},
) {
  return {
    items: [{ name: "Suwa", quantity: 1 }],
    hub: "Eastgate",
    pickup_time: "08:30",
    confidence: "high",
    notes: "",
    ...overrides,
  };
}

function getValue(
  result: ReturnType<typeof validateParsedOrder>,
): ParsedOrderOutput {
  assert.ok(!("error" in result));
  return result.value;
}

describe("validateParsedOrder", () => {
  it("accepts a fully valid high-confidence interpretation", () => {
    const input = {
      items: [{ name: "  Culture Suwa  ", quantity: 2 }],
      hub: "Eastgate",
      pickup_time: "08:30",
      confidence: "high",
      notes: "Extra sauce on the side",
    };

    const result = validateParsedOrder(input);
    const output = getValue(result);

    assert.strictEqual(output.items.length, 1);
    assert.strictEqual(output.items[0].name, "Culture Suwa");
    assert.strictEqual(output.items[0].quantity, 2);
    assert.strictEqual(output.hub, "Eastgate");
    assert.strictEqual(output.pickup_time, "08:30");
    assert.strictEqual(output.confidence, "high");
  });

  it("rejects a non-object top-level value", () => {
    const result = validateParsedOrder("just a string");

    assert.ok("error" in result);
  });

  it("rejects null as a top-level value", () => {
    const result = validateParsedOrder(null);

    assert.ok("error" in result);
  });

  it("rejects an array as a top-level value", () => {
    const result = validateParsedOrder([]);

    assert.ok("error" in result);
  });

  it("rejects a missing items field", () => {
    const input = createValidInput();
    delete (input as Record<string, unknown>).items;

    const result = validateParsedOrder(input);

    assert.ok("error" in result);
  });

  it("rejects items when they are not an array", () => {
    const result = validateParsedOrder(
      createValidInput({ items: "Suwa" }),
    );

    assert.ok("error" in result);
  });

  it("rejects an empty items array", () => {
    const result = validateParsedOrder(
      createValidInput({ items: [] }),
    );

    assert.ok("error" in result);
  });

  it("accepts exactly the maximum number of meal items", () => {
    const items = Array.from(
      { length: MAX_MEAL_ITEMS },
      (_, index) => ({
        name: `Meal ${index + 1}`,
        quantity: 1,
      }),
    );

    const result = validateParsedOrder(
      createValidInput({ items }),
    );

    assert.strictEqual(getValue(result).items.length, MAX_MEAL_ITEMS);
  });

  it("rejects more than the maximum number of meal items", () => {
    const items = Array.from(
      { length: MAX_MEAL_ITEMS + 1 },
      (_, index) => ({
        name: `Meal ${index + 1}`,
        quantity: 1,
      }),
    );

    const result = validateParsedOrder(
      createValidInput({ items }),
    );

    assert.ok("error" in result);
  });

  it("rejects an item that is not an object", () => {
    const result = validateParsedOrder(
      createValidInput({ items: ["Suwa"] }),
    );

    assert.ok("error" in result);
  });

  it("rejects an item name that is not a string", () => {
    const result = validateParsedOrder(
      createValidInput({
        items: [{ name: 123, quantity: 1 }],
      }),
    );

    assert.ok("error" in result);
  });

  it("rejects an item name containing only whitespace", () => {
    const result = validateParsedOrder(
      createValidInput({
        items: [{ name: "   ", quantity: 1 }],
      }),
    );

    assert.ok("error" in result);
  });

  it("rejects item names shorter than the minimum length", () => {
    const result = validateParsedOrder(
      createValidInput({
        items: [{ name: "A", quantity: 1 }],
      }),
    );

    assert.ok("error" in result);
  });

  it("accepts an item name at the minimum length", () => {
    const result = validateParsedOrder(
      createValidInput({
        items: [{ name: "AB", quantity: 1 }],
      }),
    );

    assert.strictEqual(getValue(result).items[0].name, "AB");
  });

  it("accepts an item name at the maximum length", () => {
    const name = "A".repeat(MAX_ITEM_NAME_LENGTH);

    const result = validateParsedOrder(
      createValidInput({
        items: [{ name, quantity: 1 }],
      }),
    );

    assert.strictEqual(
      getValue(result).items[0].name.length,
      MAX_ITEM_NAME_LENGTH,
    );
  });

  it("rejects item names longer than the maximum length", () => {
    const name = "A".repeat(MAX_ITEM_NAME_LENGTH + 1);

    const result = validateParsedOrder(
      createValidInput({
        items: [{ name, quantity: 1 }],
      }),
    );

    assert.ok("error" in result);
  });

  it("accepts extra item fields without using them", () => {
    const result = validateParsedOrder(
      createValidInput({
        items: [
          { name: "Suwa", quantity: 1, price_each: 12.5 },
        ],
      }),
    );

    assert.deepStrictEqual(getValue(result).items, [
      { name: "Suwa", quantity: 1 },
    ]);
  });

  it("rejects quantity as a string", () => {
    const result = validateParsedOrder(
      createValidInput({
        items: [{ name: "Suwa", quantity: "2" }],
      }),
    );

    assert.ok("error" in result);
  });

  it("rejects quantity of zero", () => {
    const result = validateParsedOrder(
      createValidInput({
        items: [{ name: "Suwa", quantity: 0 }],
      }),
    );

    assert.ok("error" in result);
  });

  it("rejects negative quantity", () => {
    const result = validateParsedOrder(
      createValidInput({
        items: [{ name: "Suwa", quantity: -1 }],
      }),
    );

    assert.ok("error" in result);
  });

  it("rejects a fractional quantity", () => {
    const result = validateParsedOrder(
      createValidInput({
        items: [{ name: "Suwa", quantity: 2.5 }],
      }),
    );

    assert.ok("error" in result);
  });

  it("rejects quantities above 20", () => {
    const result = validateParsedOrder(
      createValidInput({
        items: [{ name: "Suwa", quantity: 21 }],
      }),
    );

    assert.ok("error" in result);
  });

  it("accepts quantity of 20", () => {
    const result = validateParsedOrder(
      createValidInput({
        items: [{ name: "Suwa", quantity: 20 }],
      }),
    );

    assert.strictEqual(getValue(result).items[0].quantity, 20);
  });

  it("rejects an invalid hub", () => {
    const result = validateParsedOrder(
      createValidInput({ hub: "Harare" }),
    );

    assert.ok("error" in result);
  });

  it("accepts each supported hub", () => {
    for (const hub of ["Eastgate", "Joina City", "Avondale"]) {
      const result = validateParsedOrder(
        createValidInput({ hub }),
      );

      assert.strictEqual(getValue(result).hub, hub);
    }
  });

  it("rejects pickup_time with the wrong format", () => {
    const result = validateParsedOrder(
      createValidInput({ pickup_time: "8:30 AM" }),
    );

    assert.ok("error" in result);
  });

  it("rejects pickup_time earlier than 08:00", () => {
    const result = validateParsedOrder(
      createValidInput({ pickup_time: "07:00" }),
    );

    assert.ok("error" in result);
  });

  it("rejects invalid pickup minutes", () => {
    const result = validateParsedOrder(
      createValidInput({ pickup_time: "08:60" }),
    );

    assert.ok("error" in result);
  });

  it("rejects invalid confidence", () => {
    const result = validateParsedOrder(
      createValidInput({ confidence: "very-high" }),
    );

    assert.ok("error" in result);
  });

  it("accepts medium confidence", () => {
    const result = validateParsedOrder(
      createValidInput({ confidence: "medium" }),
    );

    assert.strictEqual(getValue(result).confidence, "medium");
  });

  it("accepts low confidence", () => {
    const result = validateParsedOrder(
      createValidInput({ confidence: "low" }),
    );

    assert.strictEqual(getValue(result).confidence, "low");
  });

  it("normalizes pickup_time whitespace", () => {
    const result = validateParsedOrder(
      createValidInput({
        hub: "Joina City",
        pickup_time: " 09:05 ",
      }),
    );

    const output = getValue(result);

    assert.strictEqual(output.pickup_time, "09:05");
    assert.strictEqual(output.hub, "Joina City");
  });

  it("defaults missing notes to an empty string", () => {
    const input = createValidInput();
    delete (input as Record<string, unknown>).notes;

    const result = validateParsedOrder(input);

    assert.strictEqual(getValue(result).notes, "");
  });

  it("trims notes", () => {
    const result = validateParsedOrder(
      createValidInput({ notes: "  Extra sauce  " }),
    );

    assert.strictEqual(getValue(result).notes, "Extra sauce");
  });

  it("accepts notes at the maximum length", () => {
    const notes = "A".repeat(MAX_NOTES_LENGTH);

    const result = validateParsedOrder(
      createValidInput({ notes }),
    );

    assert.strictEqual(getValue(result).notes.length, MAX_NOTES_LENGTH);
  });

  it("rejects notes longer than the maximum length", () => {
    const notes = "A".repeat(MAX_NOTES_LENGTH + 1);

    const result = validateParsedOrder(
      createValidInput({ notes }),
    );

    assert.ok("error" in result);
  });

  it("rejects notes when they are not a string", () => {
    const result = validateParsedOrder(
      createValidInput({ notes: 123 }),
    );

    assert.ok("error" in result);
  });
});
