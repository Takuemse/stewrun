
export const VALID_HUBS = ["Eastgate", "Joina City", "Avondale"] as const;

export const MAX_PARSE_INPUT_LENGTH = 2000;
export const MAX_MEAL_ITEMS = 20;
export const MIN_ITEM_NAME_LENGTH = 2;
export const MAX_ITEM_NAME_LENGTH = 150;
export const MAX_ITEM_QUANTITY = 20;
export const MAX_NOTES_LENGTH = 1000;
export const MAX_BUDGET = 99_999_999.99;

export type Hub = (typeof VALID_HUBS)[number];
export type Confidence = "high" | "medium" | "low";
export type MealClarification = "meat_type" | null;

export interface ParsedOrderOutput {
  items: Array<{
    name: string;
    quantity: number;
  }>;
  budget: number | null;
  hub: Hub;
  pickup_time: string;
  confidence: Confidence;
  notes: string;
  clarification: MealClarification;
}

function isHub(value: unknown): value is Hub {
  return (
    typeof value === "string" &&
    VALID_HUBS.includes(value as Hub)
  );
}

function isConfidence(value: unknown): value is Confidence {
  return (
    value === "high" ||
    value === "medium" ||
    value === "low"
  );
}

function isValidBudget(value: unknown): value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAX_BUDGET
  ) {
    return false;
  }

  return Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}

export function validateParsedOrder(
  parsed: unknown,
): { error: string } | { value: ParsedOrderOutput } {
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    return { error: "AI response must be a JSON object" };
  }

  const obj = parsed as Record<string, unknown>;

  if (!Object.prototype.hasOwnProperty.call(obj, "items")) {
    return { error: "Missing field: items" };
  }

  if (!Array.isArray(obj.items)) {
    return { error: "'items' must be an array" };
  }

  if (obj.items.length === 0) {
    return { error: "'items' must not be empty" };
  }

  if (obj.items.length > MAX_MEAL_ITEMS) {
    return {
      error: `A maximum of ${MAX_MEAL_ITEMS} meal items is allowed`,
    };
  }

  const validatedItems: ParsedOrderOutput["items"] = [];

  for (let i = 0; i < obj.items.length; i++) {
    const rawItem = obj.items[i];

    if (
      rawItem === null ||
      typeof rawItem !== "object" ||
      Array.isArray(rawItem)
    ) {
      return { error: `items[${i}] must be an object` };
    }

    const item = rawItem as Record<string, unknown>;

    if (typeof item.name !== "string") {
      return {
        error: `items[${i}].name must be a string`,
      };
    }

    const name = item.name.trim();

    if (name.length < MIN_ITEM_NAME_LENGTH) {
      return {
        error: `items[${i}].name must contain at least ${MIN_ITEM_NAME_LENGTH} characters`,
      };
    }

    if (name.length > MAX_ITEM_NAME_LENGTH) {
      return {
        error: `items[${i}].name must not exceed ${MAX_ITEM_NAME_LENGTH} characters`,
      };
    }

    const quantity = item.quantity;

    if (
      typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      !Number.isInteger(quantity)
    ) {
      return {
        error: `items[${i}].quantity must be a whole number`,
      };
    }

    if (quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      return {
        error: `items[${i}].quantity must be between 1 and ${MAX_ITEM_QUANTITY}`,
      };
    }

    validatedItems.push({
      name,
      quantity,
    });
  }

  let budget: number | null = null;

  if (obj.budget !== undefined && obj.budget !== null) {
    if (!isValidBudget(obj.budget)) {
      return {
        error: "budget must be a positive amount with no more than two decimal places",
      };
    }

    budget = obj.budget;
  }

  if (!isHub(obj.hub)) {
    return {
      error: "Invalid hub; must be Eastgate, Joina City or Avondale",
    };
  }

  if (
    typeof obj.pickup_time !== "string" ||
    obj.pickup_time.trim() === ""
  ) {
    return { error: "Missing field: pickup_time" };
  }

  const trimmedTime = obj.pickup_time.trim();
  const timeMatch = trimmedTime.match(/^(\d{2}):(\d{2})$/);

  if (!timeMatch) {
    return { error: "Invalid pickup_time; expected HH:MM" };
  }

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (hours < 8 || hours > 23 || minutes < 0 || minutes > 59) {
    return {
      error: "Invalid pickup_time; time must be between 08:00 and 23:59",
    };
  }

  if (!isConfidence(obj.confidence)) {
    return {
      error: "Invalid confidence; must be high, medium or low",
    };
  }

  const clarification = obj.clarification;

  if (clarification !== null && clarification !== "meat_type") {
    return {
      error: "Invalid clarification; expected meat_type or null",
    };
  }

  let notes = "";

  if (obj.notes !== undefined) {
    if (typeof obj.notes !== "string") {
      return { error: "notes must be a string" };
    }

    notes = obj.notes.trim();

    if (notes.length > MAX_NOTES_LENGTH) {
      return {
        error: `notes must not exceed ${MAX_NOTES_LENGTH} characters`,
      };
    }
  }

  return {
    value: {
      items: validatedItems,
      budget,
      hub: obj.hub,
      pickup_time: trimmedTime,
      confidence: obj.confidence,
      notes,
      clarification,
    },
  };
}
