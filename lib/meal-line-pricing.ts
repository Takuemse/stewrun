
export type PriceValue = number | string;

export interface MealPricingLine {
  quantity: number;
  unit_price: PriceValue;
  line_total: PriceValue;
}

const CURRENCY_TOLERANCE = 0.01;

/**
 * Accepts positive finite monetary values only.
 * Numeric strings must contain digits and at most two decimal places.
 */
export function isValidPositiveAmount(value: PriceValue): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }

  if (
    typeof value !== "string" ||
    !/^\d{1,10}(?:\.\d{1,2})?$/.test(value)
  ) {
    return false;
  }

  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

export function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0;
}

export function formatUsd(amount: PriceValue): string {
  if (!isValidPositiveAmount(amount)) {
    return "Price unavailable";
  }

  return `USD ${Number(amount).toFixed(2)}`;
}

/**
 * Checks persisted line_total against quantity × unit_price.
 * This function never changes or recalculates the persisted value.
 */
export function checkLineTotalConsistency(
  item: MealPricingLine,
): boolean {
  if (
    !isValidQuantity(item.quantity) ||
    !isValidPositiveAmount(item.unit_price) ||
    !isValidPositiveAmount(item.line_total)
  ) {
    return false;
  }

  const expectedTotal = item.quantity * Number(item.unit_price);
  const persistedTotal = Number(item.line_total);

  return (
    Number.isFinite(expectedTotal) &&
    Math.abs(expectedTotal - persistedTotal) <= CURRENCY_TOLERANCE + 1e-9
  );
}

/**
 * Returns the sum of persisted line totals in cents.
 * Returns null if any line contains invalid quantity or pricing data.
 */
export function getMealSubtotal(
  items: MealPricingLine[],
): number | null {
  if (items.length === 0) {
    return null;
  }

  let subtotalInCents = 0;

  for (const item of items) {
    if (
      !isValidQuantity(item.quantity) ||
      !isValidPositiveAmount(item.unit_price) ||
      !isValidPositiveAmount(item.line_total)
    ) {
      return null;
    }

    subtotalInCents += Math.round(Number(item.line_total) * 100);
  }

  return subtotalInCents / 100;
}

export function getMealLineCountLabel(count: number): string {
  if (!Number.isInteger(count) || count <= 0) {
    return "Meal items unavailable";
  }

  if (count === 1) {
    return "Single meal item";
  }

  return `${count} meal items`;
}
