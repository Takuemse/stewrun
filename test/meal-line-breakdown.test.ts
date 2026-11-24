
import * as mocha from "mocha";
import assert from "node:assert";

import {
  checkLineTotalConsistency,
  formatUsd,
  getMealLineCountLabel,
  getMealSubtotal,
  isValidPositiveAmount,
  isValidQuantity,
  type MealPricingLine,
} from "../lib/meal-line-pricing";

const { describe, it } = mocha;

describe("Meal line pricing utilities", () => {
  describe("isValidPositiveAmount", () => {
    it("accepts a positive number", () => {
      assert.strictEqual(isValidPositiveAmount(12.5), true);
    });

    it("accepts a positive numeric string", () => {
      assert.strictEqual(isValidPositiveAmount("12.50"), true);
    });

    it("rejects zero", () => {
      assert.strictEqual(isValidPositiveAmount(0), false);
    });

    it("rejects negative amounts", () => {
      assert.strictEqual(isValidPositiveAmount(-1), false);
    });

    it("rejects NaN", () => {
      assert.strictEqual(isValidPositiveAmount(NaN), false);
    });

    it("rejects positive Infinity", () => {
      assert.strictEqual(isValidPositiveAmount(Infinity), false);
    });

    it("rejects negative Infinity", () => {
      assert.strictEqual(isValidPositiveAmount(-Infinity), false);
    });

    it("rejects non-numeric strings", () => {
      assert.strictEqual(isValidPositiveAmount("abc"), false);
    });

    it("rejects whitespace-only strings", () => {
      assert.strictEqual(isValidPositiveAmount("   "), false);
    });

    it("rejects strings with excessive decimal places", () => {
      assert.strictEqual(isValidPositiveAmount("1.234"), false);
    });
  });

  describe("isValidQuantity", () => {
    it("accepts a positive integer", () => {
      assert.strictEqual(isValidQuantity(3), true);
    });

    it("rejects zero", () => {
      assert.strictEqual(isValidQuantity(0), false);
    });

    it("rejects negative quantities", () => {
      assert.strictEqual(isValidQuantity(-2), false);
    });

    it("rejects fractional quantities", () => {
      assert.strictEqual(isValidQuantity(1.5), false);
    });

    it("rejects NaN and Infinity", () => {
      assert.strictEqual(isValidQuantity(NaN), false);
      assert.strictEqual(isValidQuantity(Infinity), false);
    });
  });

  describe("formatUsd", () => {
    it("formats numbers to two decimal places", () => {
      assert.strictEqual(formatUsd(15.5), "USD 15.50");
    });

    it("formats numeric strings", () => {
      assert.strictEqual(formatUsd("15.5"), "USD 15.50");
    });

    it("returns an unavailable message for invalid prices", () => {
      assert.strictEqual(formatUsd(NaN), "Price unavailable");
      assert.strictEqual(formatUsd(Infinity), "Price unavailable");
      assert.strictEqual(formatUsd("abc"), "Price unavailable");
      assert.strictEqual(formatUsd(0), "Price unavailable");
      assert.strictEqual(formatUsd(-5), "Price unavailable");
    });
  });

  describe("checkLineTotalConsistency", () => {
    const validLine: MealPricingLine = {
      quantity: 2,
      unit_price: 5.5,
      line_total: 11,
    };

    it("accepts an exact quantity-times-price match", () => {
      assert.strictEqual(checkLineTotalConsistency(validLine), true);
    });

    it("accepts a difference within one cent", () => {
      assert.strictEqual(
        checkLineTotalConsistency({
          ...validLine,
          line_total: 11.01,
        }),
        true,
      );
    });

    it("rejects a difference greater than one cent", () => {
      assert.strictEqual(
        checkLineTotalConsistency({
          ...validLine,
          line_total: 11.02,
        }),
        false,
      );
    });

    it("supports numeric strings", () => {
      assert.strictEqual(
        checkLineTotalConsistency({
          quantity: 2,
          unit_price: "5.50",
          line_total: "11.00",
        }),
        true,
      );
    });

    it("rejects invalid quantities", () => {
      assert.strictEqual(
        checkLineTotalConsistency({
          ...validLine,
          quantity: 0,
        }),
        false,
      );
    });

    it("rejects invalid prices", () => {
      assert.strictEqual(
        checkLineTotalConsistency({
          ...validLine,
          unit_price: -1,
        }),
        false,
      );
    });
  });

  describe("getMealSubtotal", () => {
    it("sums persisted line totals", () => {
      const items: MealPricingLine[] = [
        { quantity: 2, unit_price: 5, line_total: 10 },
        { quantity: 1, unit_price: 3.5, line_total: 3.5 },
      ];

      assert.strictEqual(getMealSubtotal(items), 13.5);
    });

    it("uses cents to avoid floating-point addition errors", () => {
      const items: MealPricingLine[] = [
        { quantity: 1, unit_price: 0.1, line_total: 0.1 },
        { quantity: 1, unit_price: 0.2, line_total: 0.2 },
      ];

      assert.strictEqual(getMealSubtotal(items), 0.3);
    });

    it("returns null when a line total is invalid", () => {
      const items: MealPricingLine[] = [
        { quantity: 1, unit_price: 5, line_total: 5 },
        { quantity: 1, unit_price: 3, line_total: NaN },
      ];

      assert.strictEqual(getMealSubtotal(items), null);
    });

    it("returns null when a unit price is invalid", () => {
      const items: MealPricingLine[] = [
        { quantity: 1, unit_price: 5, line_total: 5 },
        { quantity: 1, unit_price: 0, line_total: 3 },
      ];

      assert.strictEqual(getMealSubtotal(items), null);
    });

    it("returns null when a quantity is invalid", () => {
      const items: MealPricingLine[] = [
        { quantity: 1, unit_price: 5, line_total: 5 },
        { quantity: 1.5, unit_price: 3, line_total: 4.5 },
      ];

      assert.strictEqual(getMealSubtotal(items), null);
    });

    it("returns null for an empty list", () => {
      assert.strictEqual(getMealSubtotal([]), null);
    });
  });

  describe("getMealLineCountLabel", () => {
    it("uses singular wording for one item", () => {
      assert.strictEqual(getMealLineCountLabel(1), "Single meal item");
    });

    it("uses item count wording for multiple lines", () => {
      assert.strictEqual(getMealLineCountLabel(3), "3 meal items");
    });

    it("rejects invalid counts", () => {
      assert.strictEqual(
        getMealLineCountLabel(0),
        "Meal items unavailable",
      );
    });
  });
});
