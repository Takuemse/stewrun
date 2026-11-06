
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthenticatedUser } from "@/lib/supabase/auth.server";
import { readRequestBody } from "@/lib/request-body";
import {
  MAX_MEAL_ITEMS,
  MAX_NOTES_LENGTH,
  MAX_PARSE_INPUT_LENGTH,
  validateParsedOrder,
} from "@/lib/parse-order";

const OPENAI_MODEL = "gpt-6-luna";
const MAX_REQUEST_BODY_BYTES = 16_384;

const orderResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      minItems: 0,
      maxItems: MAX_MEAL_ITEMS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            description:
              "The exact food or meal requested, accurately interpreted.",
          },
          quantity: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Number of portions requested.",
          },
        },
        required: ["name", "quantity"],
      },
    },
    hub: {
      type: "string",
      enum: ["Eastgate", "Joina City", "Avondale"],
    },
    pickup_time: {
      type: "string",
      description: "Pickup time in 24-hour HH:MM format.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
    notes: {
      type: "string",
      description: "Clarifications or assumptions made.",
    },
  },
  required: ["items", "hub", "pickup_time", "confidence", "notes"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getOpenAIStatus(error: unknown): number | undefined {
  if (
    error &&
    typeof error === "object" &&
    "status" in error
  ) {
    const status = Number(error.status);
    return Number.isFinite(status) ? status : undefined;
  }

  return undefined;
}

export async function POST(request: Request) {
  // 1. Authenticate the user and check their role.
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  if (auth.role !== "customer") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  // 2. Reject a declared oversized body before reading it.
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    const declaredBodyBytes = Number(contentLength);

    if (
      !Number.isSafeInteger(declaredBodyBytes) ||
      declaredBodyBytes < 0
    ) {
      return NextResponse.json(
        { error: "Invalid request body size." },
        { status: 400 },
      );
    }

    if (declaredBodyBytes > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 },
      );
    }
  }

  // 3. Read the body while enforcing the actual byte limit.
  const bodyResult = await readRequestBody(
    request,
    MAX_REQUEST_BODY_BYTES,
  );

  if (!bodyResult.ok) {
    if (bodyResult.reason === "too_large") {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 },
      );
    }

    return NextResponse.json(
      { error: "Could not read request body." },
      { status: 400 },
    );
  }

  // 4. Parse the JSON request.
  let body: unknown;

  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const input = body.input;

  if (typeof input !== "string" || input.trim() === "") {
    return NextResponse.json(
      { error: "Please provide a meal request." },
      { status: 400 },
    );
  }

  const trimmedInput = input.trim();

  if (Array.from(trimmedInput).length > MAX_PARSE_INPUT_LENGTH) {
    return NextResponse.json(
      {
        error: `Meal request must not exceed ${MAX_PARSE_INPUT_LENGTH} characters.`,
      },
      { status: 413 },
    );
  }

  // 5. Verify API configuration.
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("OPENAI_API_KEY is not configured.");

    return NextResponse.json(
      { error: "AI service is not configured." },
      { status: 500 },
    );
  }

  const openai = new OpenAI({
    apiKey,
    timeout: 20000,
    maxRetries: 1,
  });

  // 6. Prepare interpretation instructions.
  const instructions = [
    "You are the meal-order interpreter for StewRun, a Harare lunch pre-ordering service.",
    "Interpret customer requests written in English, Shona, or a mixture of both.",
    "Identify only the food items and ingredients the customer actually requests.",
    "Never invent, add, assume, or substitute food items or ingredients.",
    "Do not add vegetables, meat, rice, sauce, or any other ingredient unless the customer mentions it or the meaning is unambiguously present in their words.",
    "For example, 'ndinoda sadza nenyama' means the customer wants sadza with meat. Do not add vegetables.",
    "For example, 'Sadza ne nyama' is a valid request for sadza with meat, even though the request is short.",
    "Preserve the customer's intended meal accurately. You may translate Shona food descriptions into English without changing their meaning.",
    "Do not treat a short but understandable meal request as ambiguous merely because it contains few words.",
    "If no quantity is stated, use quantity 1.",
    "If the customer requests two plates or two portions of a meal, represent that as quantity 2, not two duplicate items.",
    "Each quantity must be a whole number between 1 and 20.",
    "Return distinct requested food items only, with a maximum of 20 items.",
    "Each food item name must contain between 2 and 150 characters.",
    "If the request does not identify any food item, return an empty items array.",
    "Never create placeholder items such as 'Unclear request', 'Unknown meal', or 'Lunch'.",
    "For gibberish, unrelated text, or requests that do not identify food, return an empty items array and low confidence.",
    "If the customer says something broad such as 'I want lunch' without identifying food, return an empty items array.",
    "If a food description is genuinely ambiguous, use low confidence and explain what needs clarification in notes. Do not guess the missing ingredients.",
    "Supported pickup hubs are Eastgate, Joina City, and Avondale.",
    "If the customer does not specify a hub, use Eastgate as the temporary default and mention this in notes.",
    "Pickup time must use 24-hour HH:MM format and must not be earlier than 08:00.",
    "If no pickup time is specified, use 12:00 and explain this default in notes.",
    "Notes must not exceed 1000 characters.",
    "Never estimate or invent meal prices.",
    "Return only the structured response matching the supplied schema.",
  ].join("\n");

  // 7. Request structured output from OpenAI.
  let parsed: unknown;

  try {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      instructions,
      input: trimmedInput,
      store: false,
      max_output_tokens: 500,
      text: {
        format: {
          type: "json_schema",
          name: "stewrun_order",
          strict: true,
          schema: orderResponseSchema,
        },
      },
    });

    if (!response.output_text) {
      console.error(
        "OpenAI returned no text. Response status:",
        response.status,
      );

      return NextResponse.json(
        { error: "AI returned no interpretation. Please try again." },
        { status: 502 },
      );
    }

    parsed = JSON.parse(response.output_text);
  } catch (error) {
    const status = getOpenAIStatus(error);

    console.error("OpenAI API request failed:", {
      status,
      message: error instanceof Error
        ? error.message
        : "Unknown error",
    });

    if (status === 401) {
      return NextResponse.json(
        { error: "AI authentication failed. Check the API configuration." },
        { status: 502 },
      );
    }

    if (status === 429) {
      return NextResponse.json(
        { error: "AI request limit reached. Please try again shortly." },
        { status: 429 },
      );
    }

    if (status === 503 || status === 502 || status === 500) {
      return NextResponse.json(
        { error: "AI service is temporarily unavailable. Please try again." },
        { status: 503 },
      );
    }

    if (status === 408 || status === 504) {
      return NextResponse.json(
        { error: "AI request timed out. Please try again." },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: "Failed to process your request. Please try again." },
      { status: 502 },
    );
  }

  // 8. Reject responses that do not identify any food.
  if (
    isRecord(parsed) &&
    Array.isArray(parsed.items) &&
    parsed.items.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "We couldn't identify a meal in your request. Please describe the food you'd like.",
      },
      { status: 422 },
    );
  }

  // 9. Independently validate the AI output.
  const validated = validateParsedOrder(parsed);

  if ("error" in validated) {
    console.error(
      "OpenAI response validation failed:",
      validated.error,
    );

    return NextResponse.json(
      { error: validated.error },
      { status: 422 },
    );
  }

  const output = validated.value;

  // 10. Flag uncertain interpretations.
  if (output.confidence === "low") {
    const verificationNote = "(please verify carefully)";

    output.notes = output.notes
      ? `${output.notes} ${verificationNote}`.slice(0, MAX_NOTES_LENGTH)
      : "(please verify this interpretation carefully)";
  }

  return NextResponse.json(output);
}
