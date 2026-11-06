
import { NextResponse } from "next/server";
import {
  getAuthenticatedUser,
  createServerSupabaseClient,
} from "@/lib/supabase/auth.server";
import { readRequestBody } from "@/lib/request-body";

const VALID_HUBS = ["Eastgate", "Joina City", "Avondale"] as const;
const MAX_REQUEST_BODY_BYTES = 16_384;

const REQUEST_SELECT =
  "id, items, budget, hub, pickup_date, pickup_time, notes, status, created_at, offers_close_at";

type PickupHub = (typeof VALID_HUBS)[number];

interface MealRequestItem {
  name: string;
  quantity: number;
}

interface SubmittedRequest {
  items: MealRequestItem[];
  hub: PickupHub;
  pickupDate: string;
  pickupTime: string;
  notes: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isPickupHub(value: unknown): value is PickupHub {
  return (
    typeof value === "string" &&
    VALID_HUBS.some((hub) => hub === value)
  );
}

function isValidSubmissionKey(value: string | null): value is string {
  return (
    value !== null &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function validateItems(
  value: unknown,
):
  | { error: string }
  | { items: MealRequestItem[] } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "Add at least one meal item." };
  }

  if (value.length > 20) {
    return { error: "A request cannot contain more than 20 items." };
  }

  const items: MealRequestItem[] = [];

  for (let index = 0; index < value.length; index++) {
    const item = value[index];

    if (!isRecord(item)) {
      return { error: `Meal item ${index + 1} is invalid.` };
    }

    const keys = Object.keys(item);

    if (
      keys.length !== 2 ||
      !Object.prototype.hasOwnProperty.call(item, "name") ||
      !Object.prototype.hasOwnProperty.call(item, "quantity")
    ) {
      return { error: `Meal item ${index + 1} has invalid fields.` };
    }

    if (typeof item.name !== "string") {
      return { error: `Meal item ${index + 1} needs a valid name.` };
    }

    const name = item.name.trim();

    if (name.length < 2 || name.length > 150) {
      return {
        error: `Meal item ${index + 1} must have a name between 2 and 150 characters.`,
      };
    }

    if (
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20
    ) {
      return {
        error: `Meal item ${index + 1} must have a quantity between 1 and 20.`,
      };
    }

    items.push({
      name,
      quantity: item.quantity,
    });
  }

  return { items };
}

function areItemsEqual(
  existingItems: unknown,
  submittedItems: MealRequestItem[],
): boolean {
  if (
    !Array.isArray(existingItems) ||
    existingItems.length !== submittedItems.length
  ) {
    return false;
  }

  return existingItems.every((existingItem, index) => {
    if (!isRecord(existingItem)) {
      return false;
    }

    return (
      existingItem.name === submittedItems[index].name &&
      existingItem.quantity === submittedItems[index].quantity
    );
  });
}

function matchesSubmittedRequest(
  existing: unknown,
  submitted: SubmittedRequest,
): boolean {
  if (!isRecord(existing)) {
    return false;
  }

  const existingPickupTime =
    typeof existing.pickup_time === "string"
      ? existing.pickup_time.slice(0, 5)
      : null;

  return (
    areItemsEqual(existing.items, submitted.items) &&
    existing.hub === submitted.hub &&
    existing.pickup_date === submitted.pickupDate &&
    existingPickupTime === submitted.pickupTime &&
    existing.notes === submitted.notes
  );
}

/**
 * Converts a date and local Harare time into a UTC ISO timestamp.
 *
 * We use Intl rather than assuming the customer's browser timezone.
 */
function harareDateTimeToIso(
  dateString: string,
  hour: number,
  minute: number,
): string {
  const [year, month, day] = dateString.split("-").map(Number);

  const targetAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
  );

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(new Date(targetAsUtc));
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  const harareTimeAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );

  const timezoneOffset = harareTimeAsUtc - targetAsUtc;

  return new Date(targetAsUtc - timezoneOffset).toISOString();
}

async function findExistingRequestResponse(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  customerId: string,
  submissionKey: string,
  submitted: SubmittedRequest,
): Promise<NextResponse | null> {
  const { data, error } = await supabase
    .from("meal_requests")
    .select(REQUEST_SELECT)
    .eq("customer_id", customerId)
    .eq("submission_key", submissionKey)
    .maybeSingle();

  if (error) {
    console.error("Existing meal request lookup failed:", {
      code: error.code,
      message: error.message,
    });

    return NextResponse.json(
      { error: "We could not verify your previous submission." },
      { status: 500 },
    );
  }

  if (!data) {
    return null;
  }

  if (!matchesSubmittedRequest(data, submitted)) {
    return NextResponse.json(
      {
        error:
          "This submission key has already been used for different request details. Please start a new submission.",
      },
      { status: 409 },
    );
  }

  // The same logical submission already exists.
  return NextResponse.json(
    { request: data },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  // 1. Authenticate the user.
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  if (auth.role !== "customer") {
    return NextResponse.json(
      { error: "Customer access required." },
      { status: 403 },
    );
  }

  // 2. Require a valid UUID v4 idempotency key.
  const submissionKey = request.headers.get("idempotency-key");

  if (!isValidSubmissionKey(submissionKey)) {
    return NextResponse.json(
      { error: "A valid submission key is required." },
      { status: 400 },
    );
  }

  // 3. Reject a declared oversized body before reading it.
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    const declaredSize = Number(contentLength);

    if (
      !Number.isSafeInteger(declaredSize) ||
      declaredSize < 0
    ) {
      return NextResponse.json(
        { error: "Invalid request size." },
        { status: 400 },
      );
    }

    if (declaredSize > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 },
      );
    }
  }

  // 4. Read the body while enforcing the actual byte limit.
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

  // 5. Parse JSON.
  let body: unknown;

  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      { error: "Invalid request data." },
      { status: 400 },
    );
  }

  // 6. Validate meal items.
  const validatedItems = validateItems(body.items);

  if ("error" in validatedItems) {
    return NextResponse.json(
      { error: validatedItems.error },
      { status: 400 },
    );
  }

  // 7. Validate pickup hub.
  if (!isPickupHub(body.hub)) {
    return NextResponse.json(
      { error: "Please select a valid pickup hub." },
      { status: 400 },
    );
  }

  // 8. Validate pickup date.
  if (
    typeof body.pickup_date !== "string" ||
    !isValidDate(body.pickup_date)
  ) {
    return NextResponse.json(
      { error: "Please select a valid pickup date." },
      { status: 400 },
    );
  }

  // 9. Validate pickup time.
  if (
    typeof body.pickup_time !== "string" ||
    !/^(0[8-9]|1\d|2[0-3]):[0-5]\d$/.test(body.pickup_time)
  ) {
    return NextResponse.json(
      { error: "Pickup time must be between 08:00 and 23:59." },
      { status: 400 },
    );
  }

  // 10. Validate optional notes.
  if (
    body.notes !== undefined &&
    body.notes !== null &&
    typeof body.notes !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid request notes." },
      { status: 400 },
    );
  }

  const notes =
    typeof body.notes === "string" ? body.notes.trim() : "";

  if (notes.length > 1000) {
    return NextResponse.json(
      { error: "Notes cannot exceed 1,000 characters." },
      { status: 400 },
    );
  }

  const submitted: SubmittedRequest = {
    items: validatedItems.items,
    hub: body.hub,
    pickupDate: body.pickup_date,
    pickupTime: body.pickup_time,
    notes: notes || null,
  };

  const supabase = await createServerSupabaseClient();

  // 11. Return an existing request before applying new-request
  // cutoff rules. A legitimate retry must still work after 10:00 AM.
  const existingResponse = await findExistingRequestResponse(
    supabase,
    auth.user.id,
    submissionKey,
    submitted,
  );

  if (existingResponse) {
    return existingResponse;
  }

  // 12. Calculate the offer deadline: 10:00 AM Harare time
  // on the customer's selected pickup date.
  const offersCloseAt = harareDateTimeToIso(
    body.pickup_date,
    10,
    0,
  );

  // 13. Save using the authenticated user's Supabase session.
  const { data, error } = await supabase
    .from("meal_requests")
    .insert({
      customer_id: auth.user.id,
      submission_key: submissionKey,
      items: validatedItems.items,
      budget: null,
      hub: body.hub,
      pickup_date: body.pickup_date,
      pickup_time: body.pickup_time,
      notes: notes || null,
      status: "open",
      offers_close_at: offersCloseAt,
    })
    .select(REQUEST_SELECT)
    .single();

  if (error) {
    // Another request with the same key may have been inserted
    // between our lookup and this insert. The unique index makes
    // the database choose only one winner.
    if (error.code === "23505") {
      const duplicateResponse = await findExistingRequestResponse(
        supabase,
        auth.user.id,
        submissionKey,
        submitted,
      );

      if (duplicateResponse) {
        return duplicateResponse;
      }
    }

    console.error("Meal request creation failed:", {
      code: error.code,
      message: error.message,
    });

    if (error.message.includes("Pickup date cannot be in the past")) {
      return NextResponse.json(
        { error: "Pickup date cannot be in the past." },
        { status: 400 },
      );
    }

    if (error.message.includes("Same-day meal requests close")) {
      return NextResponse.json(
        {
          error:
            "Same-day requests close at 10:00 AM Harare time. Please choose tomorrow or a later date.",
        },
        { status: 400 },
      );
    }

    if (error.code === "23514") {
      return NextResponse.json(
        { error: "Some request details did not pass validation." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "We could not save your meal request. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { request: data },
    { status: 201 },
  );
}
