export type CookOrderStatus = "confirmed" | "ready" | "collected";

export interface CookOrderItem {
  menu_item_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
}

export interface CookOrder {
  id: string;
  items: CookOrderItem[];
  status: CookOrderStatus;
  payment_status: "paid" | "pending";
  hub: string;
  pickup_date: string | null;
  pickup_time: string | null;
  meal_subtotal: number | string;
  created_at: string;
  collected_at: string | null;
}

export class CookOrderApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CookOrderApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isAmount(value: unknown): value is number | string {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }

  return (
    typeof value === "string" &&
    /^\d{1,10}(?:\.\d{1,2})?$/.test(value) &&
    Number(value) > 0
  );
}

function isCookOrderItem(value: unknown): value is CookOrderItem {
  return (
    isRecord(value) &&
    (value.menu_item_id === null ||
      typeof value.menu_item_id === "string") &&
    typeof value.name === "string" &&
    isNullableString(value.description) &&
    Number.isInteger(value.quantity) &&
    Number(value.quantity) > 0 &&
    isAmount(value.unit_price) &&
    isAmount(value.line_total)
  );
}

export function isCookOrder(value: unknown): value is CookOrder {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.items) &&
    value.items.every(isCookOrderItem) &&
    (value.status === "confirmed" ||
      value.status === "ready" ||
      value.status === "collected") &&
    (value.payment_status === "paid" ||
      value.payment_status === "pending") &&
    (value.status !== "collected" || value.payment_status === "paid") &&
    typeof value.hub === "string" &&
    isNullableString(value.pickup_date) &&
    isNullableString(value.pickup_time) &&
    isAmount(value.meal_subtotal) &&
    typeof value.created_at === "string" &&
    isNullableString(value.collected_at)
  );
}

function getErrorMessage(payload: unknown): string {
  if (isRecord(payload) && typeof payload.error === "string") {
    return payload.error;
  }

  return "We could not load your cook orders. Please try again.";
}

export async function fetchCookOrders(): Promise<CookOrder[]> {
  let response: Response;

  try {
    response = await fetch("/api/cook/orders", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new CookOrderApiError(
      "We could not connect to your cook orders. Please try again.",
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new CookOrderApiError(
      "The server returned an unreadable response. Please try again.",
      response.status,
    );
  }

  if (!response.ok) {
    throw new CookOrderApiError(
      getErrorMessage(payload),
      response.status,
    );
  }

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.orders) ||
    !payload.orders.every(isCookOrder)
  ) {
    throw new CookOrderApiError(
      "The cook orders service returned an unexpected response.",
    );
  }

  return payload.orders;
}
