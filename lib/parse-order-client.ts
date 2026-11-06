import {
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEM_QUANTITY,
  MAX_MEAL_ITEMS,
  MAX_NOTES_LENGTH,
  MAX_PARSE_INPUT_LENGTH,
  MIN_ITEM_NAME_LENGTH,
  VALID_HUBS,
  type Confidence,
  type Hub,
} from "./parse-order";

export const PICKUP_HUBS = VALID_HUBS;

export type PickupHub = Hub;
export type ParseConfidence = Confidence;

export interface ParsedMealRequest {
  items: Array<{
    name: string;
    quantity: number;
  }>;
  hub: PickupHub;
  pickup_time: string;
  confidence: ParseConfidence;
  notes: string;
}

export class ParseOrderApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ParseOrderApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isParsedMealRequest(value: unknown): value is ParsedMealRequest {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return false;
  }

  if (
    value.items.length === 0 ||
    value.items.length > MAX_MEAL_ITEMS
  ) {
    return false;
  }

  const validItems = value.items.every((item) => {
    if (!isRecord(item) || typeof item.name !== "string") {
      return false;
    }

    const name = item.name.trim();

    return (
      name.length >= MIN_ITEM_NAME_LENGTH &&
      name.length <= MAX_ITEM_NAME_LENGTH &&
      typeof item.quantity === "number" &&
      Number.isInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= MAX_ITEM_QUANTITY
    );
  });

  return (
    validItems &&
    typeof value.hub === "string" &&
    PICKUP_HUBS.some((hub) => hub === value.hub) &&
    typeof value.pickup_time === "string" &&
    /^(0[8-9]|1\d|2[0-3]):[0-5]\d$/.test(value.pickup_time) &&
    (
      value.confidence === "high" ||
      value.confidence === "medium" ||
      value.confidence === "low"
    ) &&
    typeof value.notes === "string" &&
    value.notes.length <= MAX_NOTES_LENGTH
  );
}

async function readErrorMessage(
  response: Response,
): Promise<string | null> {
  try {
    const body: unknown = await response.json();

    if (isRecord(body) && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    return null;
  }

  return null;
}

function messageForStatus(
  status: number,
  detail: string | null,
): string {
  switch (status) {
    case 400:
      return "Please check your meal request and try again.";

    case 401:
      return "Please sign in with your customer account to interpret a meal request.";

    case 403:
      return "Meal requests are available to customer accounts only.";

    case 413:
      return detail ||
        "Your meal request is too long. Please shorten it and try again.";

    case 422:
      return detail ||
        "We could not interpret that request. Try describing your meal another way.";

    case 429:
      return detail ||
        "The AI request limit has been reached. Please try again shortly.";

    case 502:
      return detail ||
        "Meal interpretation is temporarily unavailable. Please try again shortly.";

    case 503:
      return detail ||
        "The AI service is temporarily busy. Please try again shortly.";

    case 504:
      return detail ||
        "The AI request took too long. Please try again.";

    default:
      return detail ||
        "Something went wrong while interpreting your request.";
  }
}

export async function parseMealRequest(
  input: string,
): Promise<ParsedMealRequest> {
  if (typeof input !== "string" || input.trim() === "") {
    throw new ParseOrderApiError(
      "Please describe the meal you want.",
      400,
    );
  }

  const trimmedInput = input.trim();

  if (Array.from(trimmedInput).length > MAX_PARSE_INPUT_LENGTH) {
    throw new ParseOrderApiError(
      `Your request must not exceed ${MAX_PARSE_INPUT_LENGTH} characters.`,
      413,
    );
  }

  let response: Response;

  try {
    response = await fetch("/api/parse-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: trimmedInput }),
    });
  } catch {
    throw new ParseOrderApiError(
      "We could not connect to StewRun. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    const detail = await readErrorMessage(response);

    throw new ParseOrderApiError(
      messageForStatus(response.status, detail),
      response.status,
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new ParseOrderApiError(
      "We received an unreadable response. Please try again.",
    );
  }

  if (!isParsedMealRequest(payload)) {
    throw new ParseOrderApiError(
      "The meal interpretation was incomplete. Please try again.",
    );
  }

  return payload;
}