import type { AuthResult } from "@/lib/supabase/auth.server";
import { readRequestBody } from "@/lib/request-body";
import {
  MAX_NOTES_LENGTH,
  MAX_PARSE_INPUT_LENGTH,
  validateParsedOrder,
} from "@/lib/parse-order";

const MAX_REQUEST_BODY_BYTES = 16_384;

export interface AIResponseLike {
  status?: string;
  output_text: string;
  incomplete_details: {
    reason?: string;
  } | null;
  output: unknown[];
}

export interface ParseOrderDependencies {
  authenticate: () => Promise<AuthResult>;
  apiKey: string | undefined;
  createAIResponse: (
    input: string,
    instructions: string,
  ) => Promise<AIResponseLike>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getOpenAIStatus(error: unknown): number | undefined {
  if (isRecord(error) && "status" in error) {
    const status = Number(error.status);
    return Number.isFinite(status) ? status : undefined;
  }

  return undefined;
}

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

function containsRefusal(output: unknown[]): boolean {
  return output.some((item) => {
    if (!isRecord(item) || item.type !== "message") {
      return false;
    }

    if (!Array.isArray(item.content)) {
      return false;
    }

    return item.content.some(
      (content) =>
        isRecord(content) && content.type === "refusal",
    );
  });
}

function getInstructions(): string {
  return [
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
}

function handleAIRequestError(error: unknown): Response {
  const status = getOpenAIStatus(error);

  console.error("OpenAI API request failed:", {
    status,
    message: error instanceof Error
      ? error.message
      : "Unknown error",
  });

  if (status === 401) {
    return jsonError(
      "AI authentication failed. Check the API configuration.",
      502,
    );
  }

  if (status === 429) {
    return jsonError(
      "AI request limit reached. Please try again shortly.",
      429,
    );
  }

  if (status === 503 || status === 502 || status === 500) {
    return jsonError(
      "AI service is temporarily unavailable. Please try again.",
      503,
    );
  }

  if (status === 408 || status === 504) {
    return jsonError(
      "AI request timed out. Please try again.",
      504,
    );
  }

  return jsonError(
    "Failed to process your request. Please try again.",
    502,
  );
}

export async function handleParseOrderRequest(
  request: Request,
  dependencies: ParseOrderDependencies,
): Promise<Response> {
  // 1. Authenticate the user and check their role.
  const auth = await dependencies.authenticate();

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  if (auth.role !== "customer") {
    return jsonError("Forbidden", 403);
  }

  // 2. Reject a declared oversized body before reading it.
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    const declaredBodyBytes = Number(contentLength);

    if (
      !Number.isSafeInteger(declaredBodyBytes) ||
      declaredBodyBytes < 0
    ) {
      return jsonError("Invalid request body size.", 400);
    }

    if (declaredBodyBytes > MAX_REQUEST_BODY_BYTES) {
      return jsonError("Request body is too large.", 413);
    }
  }

  // 3. Read the body while enforcing the actual byte limit.
  const bodyResult = await readRequestBody(
    request,
    MAX_REQUEST_BODY_BYTES,
  );

  if (!bodyResult.ok) {
    if (bodyResult.reason === "too_large") {
      return jsonError("Request body is too large.", 413);
    }

    return jsonError("Could not read request body.", 400);
  }

  // 4. Parse and validate the customer's input.
  let body: unknown;

  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  if (!isRecord(body)) {
    return jsonError(
      "Request body must be a JSON object.",
      400,
    );
  }

  const input = body.input;

  if (typeof input !== "string" || input.trim() === "") {
    return jsonError("Please provide a meal request.", 400);
  }

  const trimmedInput = input.trim();

  if (Array.from(trimmedInput).length > MAX_PARSE_INPUT_LENGTH) {
    return jsonError(
      `Meal request must not exceed ${MAX_PARSE_INPUT_LENGTH} characters.`,
      413,
    );
  }

  // 5. Verify API configuration.
  if (!dependencies.apiKey) {
    console.error("OPENAI_API_KEY is not configured.");

    return jsonError("AI service is not configured.", 500);
  }

  // 6. Request structured interpretation from OpenAI.
  let response: AIResponseLike;

  try {
    response = await dependencies.createAIResponse(
      trimmedInput,
      getInstructions(),
    );
  } catch (error) {
    return handleAIRequestError(error);
  }

  // 7. Only completed responses may be processed.
  if (response.status !== "completed") {
    const reason = response.incomplete_details?.reason;

    console.error("OpenAI returned a non-completed response:", {
      status: response.status,
      reason,
    });

    if (
      response.status === "incomplete" &&
      reason === "content_filter"
    ) {
      return jsonError(
        "We couldn't interpret that request. Please rephrase it.",
        422,
      );
    }

    return jsonError(
      "AI returned an incomplete interpretation. Please try again.",
      502,
    );
  }

  // 8. Explicitly detect model refusals.
  if (containsRefusal(response.output)) {
    return jsonError(
      "We couldn't interpret that request. Please rephrase it.",
      422,
    );
  }

  // 9. Require structured text output.
  if (!response.output_text) {
    console.error("OpenAI returned no text in a completed response.");

    return jsonError(
      "AI returned no interpretation. Please try again.",
      502,
    );
  }

  // 10. Parse model output separately from the API request.
  let parsed: unknown;

  try {
    parsed = JSON.parse(response.output_text);
  } catch {
    console.error("OpenAI returned malformed JSON.");

    return jsonError(
      "AI returned an invalid interpretation. Please try again.",
      502,
    );
  }

  // 11. Reject interpretations that identify no food.
  if (
    isRecord(parsed) &&
    Array.isArray(parsed.items) &&
    parsed.items.length === 0
  ) {
    return jsonError(
      "We couldn't identify a meal in your request. Please describe the food you'd like.",
      422,
    );
  }

  // 12. Independently validate all AI-generated data.
  const validated = validateParsedOrder(parsed);

  if ("error" in validated) {
    console.error(
      "OpenAI response validation failed:",
      validated.error,
    );

    return jsonError(validated.error, 422);
  }

  const output = validated.value;

  // 13. Flag uncertain interpretations.
  if (output.confidence === "low") {
    const verificationNote = "(please verify carefully)";

    output.notes = output.notes
      ? `${output.notes} ${verificationNote}`.slice(0, MAX_NOTES_LENGTH)
      : "(please verify this interpretation carefully)";
  }

  return Response.json(output);
}



