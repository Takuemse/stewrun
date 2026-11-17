export interface CustomerOrder {
  id: string;
  total: number | string;
  status: string;
  payment_status: string;
  hub: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  reservation_expires_at: string | null;
  pickup_code?: string | null;
  cash_payment_status?: "due" | "paid" | null;
  items?: CustomerOrderItem[];
  cook_display_name?: string | null;
}

export interface CustomerOrderItem {
  menu_item_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
}

export class CustomerOrderApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CustomerOrderApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isValidAmount(value: unknown): value is number | string {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }

  return (
    typeof value === "string" &&
    /^\d{1,10}(?:\.\d{1,2})?$/.test(value) &&
    Number(value) > 0
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isCustomerOrder(value: unknown): value is CustomerOrder {
  const validItems = isRecord(value)
    ? value.items === undefined ||
      (Array.isArray(value.items) && value.items.every(isCustomerOrderItem))
    : false;

  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    isValidAmount(value.total) &&
    typeof value.status === "string" &&
    typeof value.payment_status === "string" &&
    isNullableString(value.hub) &&
    isNullableString(value.pickup_date) &&
    isNullableString(value.pickup_time) &&
    (value.reservation_expires_at === undefined ||
      isNullableString(value.reservation_expires_at)) &&
    (value.pickup_code === undefined ||
      isNullableString(value.pickup_code)) &&
    (value.cash_payment_status === undefined ||
      value.cash_payment_status === null ||
      value.cash_payment_status === "due" ||
      value.cash_payment_status === "paid") &&
    validItems &&
    (value.cook_display_name === undefined ||
      isNullableString(value.cook_display_name))
  );
}

function isCustomerOrderItem(value: unknown): value is CustomerOrderItem {
  return (
    isRecord(value) &&
    (value.menu_item_id === null || typeof value.menu_item_id === "string") &&
    typeof value.name === "string" &&
    isNullableString(value.description) &&
    Number.isInteger(value.quantity) &&
    Number(value.quantity) > 0 &&
    isValidAmount(value.unit_price) &&
    isValidAmount(value.line_total)
  );
}

function getErrorMessage(payload: unknown): string {
  if (isRecord(payload) && typeof payload.error === "string") {
    return payload.error;
  }

  return "We could not load your orders. Please try again.";
}

async function getJson(
  url: string,
): Promise<{ response: Response; payload: unknown }> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new CustomerOrderApiError(
      "We could not connect to your orders. Please try again.",
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new CustomerOrderApiError(
      "The server returned an unreadable response. Please try again.",
      response.status,
    );
  }

  if (!response.ok) {
    throw new CustomerOrderApiError(
      getErrorMessage(payload),
      response.status,
    );
  }

  return { response, payload };
}

export async function fetchCustomerOrders(): Promise<CustomerOrder[]> {
  const { payload } = await getJson("/api/orders");

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.orders) ||
    !payload.orders.every(isCustomerOrder)
  ) {
    throw new CustomerOrderApiError(
      "The orders service returned an unexpected response.",
    );
  }

  return payload.orders;
}

export async function fetchCustomerOrder(
  orderId: string,
): Promise<CustomerOrder> {
  const { payload } = await getJson(
    `/api/orders/${encodeURIComponent(orderId)}`,
  );

  if (!isRecord(payload) || !isCustomerOrder(payload.order)) {
    throw new CustomerOrderApiError(
      "The order service returned an unexpected response.",
    );
  }

  return payload.order;
}
