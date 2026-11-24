import type { CustomerOrder } from "@/lib/orders-client";
import { createClient } from "@/lib/supabase/client";

/* Light, read-only helpers for the dashboard. They reuse the existing
   endpoints (/api/meal-requests, /api/profile) and only read the fields the
   dashboard needs. Individual cook offers are NOT fetched here: the
   existing offer_count is enough. */

export interface ActivityRequest {
  id: string;
  items: { name: string; quantity: number }[];
  hub: string;
  pickup_date: string;
  pickup_time: string;
  status: string;
  created_at: string;
  offer_count: number;
  order_status: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toActivityRequest(value: unknown): ActivityRequest | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !Array.isArray(value.items) ||
    typeof value.hub !== "string" ||
    typeof value.pickup_date !== "string" ||
    typeof value.pickup_time !== "string" ||
    typeof value.status !== "string" ||
    typeof value.created_at !== "string" ||
    typeof value.offer_count !== "number" ||
    !Number.isInteger(value.offer_count) ||
    value.offer_count < 0 ||
    (value.order_status !== null && typeof value.order_status !== "string")
  ) {
    return null;
  }

  const items = value.items.flatMap((item) =>
    isRecord(item) &&
    typeof item.name === "string" &&
    typeof item.quantity === "number"
      ? [{ name: item.name, quantity: item.quantity }]
      : [],
  );

  return {
    id: value.id,
    items,
    hub: value.hub,
    pickup_date: value.pickup_date,
    pickup_time: value.pickup_time,
    status: value.status,
    created_at: value.created_at,
    offer_count: value.offer_count,
    order_status: value.order_status,
  };
}

export async function fetchActivityRequests(): Promise<ActivityRequest[]> {
  const response = await fetch("/api/meal-requests", {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response.");
  }

  if (!response.ok) {
    throw new Error(
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : "We could not load your meal requests.",
    );
  }

  if (!isRecord(payload) || !Array.isArray(payload.requests)) {
    throw new Error("The meal requests response had an unexpected format.");
  }

  return payload.requests.flatMap((raw) => {
    const parsed = toActivityRequest(raw);
    return parsed ? [parsed] : [];
  });
}

async function loadNameFromProfile(): Promise<string | null> {
  try {
    const response = await fetch("/api/profile", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (
      isRecord(payload) &&
      isRecord(payload.profile) &&
      typeof payload.profile.full_name === "string"
    ) {
      return payload.profile.full_name.trim() || null;
    }
    return null;
  } catch {
    return null;
  }
}

/* Cook accounts are not served by /api/profile, so fall back to the name saved
   at sign-up (sign-up stores full_name in the account's metadata). */
async function loadNameFromSession(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getUser();
    const metadata: unknown = data.user?.user_metadata;
    if (isRecord(metadata) && typeof metadata.full_name === "string") {
      return metadata.full_name.trim() || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function loadCustomerName(): Promise<string | null> {
  return (await loadNameFromProfile()) ?? (await loadNameFromSession());
}

/* The dashboard and the account menu both need the name, so a lookup made in
   the last few seconds is shared instead of calling /api/profile twice. */
let nameCache: { at: number; promise: Promise<string | null> } | null = null;

export function fetchCustomerName(): Promise<string | null> {
  const now = Date.now();
  if (nameCache && now - nameCache.at < 15_000) return nameCache.promise;
  const promise = loadCustomerName();
  nameCache = { at: now, promise };
  return promise;
}

/* ── Dates (Zimbabwe is UTC+02:00) ─────────────────────────────────── */

function toTimestamp(date: string | null, time: string | null): number {
  if (!date || !time) return Number.NaN;
  const fullTime = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${fullTime}+02:00`).getTime();
}

export function orderPickupTimestamp(order: CustomerOrder): number {
  return toTimestamp(order.pickup_date, order.pickup_time);
}

export function requestPickupTimestamp(request: ActivityRequest): number {
  return toTimestamp(request.pickup_date, request.pickup_time);
}

/** Mirrors the My Lunch rule: collected or cancelled requests are past. */
export function isRequestUpcoming(request: ActivityRequest, now: number) {
  if (request.order_status === "collected" || request.status === "cancelled") {
    return false;
  }
  const timestamp = requestPickupTimestamp(request);
  return Number.isNaN(timestamp) ? true : timestamp > now;
}

export function formatPickupDay(date: string | null): string {
  if (!date) return "Date pending";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return "Date pending";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function formatPickupClock(time: string | null): string {
  if (!time) return "Time pending";
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  if (Number.isNaN(hour) || !minute) return "Time pending";
  return `${hour % 12 || 12}:${minute.slice(0, 2)} ${hour >= 12 ? "PM" : "AM"}`;
}

export function formatUsdAmount(amount: number | string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount));
}

/* ── Summary and activity ──────────────────────────────────────────── */

export interface DashboardSummary {
  activeOrders: number;
  openRequests: number;
  offersToReview: number;
  collected: number;
  nextOrder: CustomerOrder | null;
  moreActive: number;
}

export function deriveSummary(
  orders: CustomerOrder[],
  requests: ActivityRequest[],
  now: number,
): DashboardSummary {
  const active = orders
    .filter((order) => order.status === "confirmed" || order.status === "ready")
    .sort((a, b) => {
      const first = orderPickupTimestamp(a);
      const second = orderPickupTimestamp(b);
      return (Number.isNaN(first) ? Infinity : first) -
        (Number.isNaN(second) ? Infinity : second);
    });

  const open = requests.filter(
    (request) =>
      request.order_status === null && isRequestUpcoming(request, now),
  );

  return {
    activeOrders: active.length,
    openRequests: open.length,
    offersToReview: open.reduce((sum, request) => sum + request.offer_count, 0),
    collected: orders.filter((order) => order.status === "collected").length,
    nextOrder: active[0] ?? null,
    moreActive: Math.max(0, active.length - 1),
  };
}

export interface ActivityItem {
  id: string;
  tone: "offer" | "order" | "done" | "muted";
  title: string;
  detail: string;
  sortTime: number;
}

function requestSummary(request: ActivityRequest): string {
  return (
    request.items.map((item) => `${item.quantity} × ${item.name}`).join(", ") ||
    "Meal request"
  );
}

/* Requests are ordered by when they were created. Orders do not expose a
   creation time, so they are ordered, and labelled, by pickup date. */
export function deriveActivity(
  orders: CustomerOrder[],
  requests: ActivityRequest[],
  now: number,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const request of requests) {
    if (request.order_status !== null) continue;
    const created = Date.parse(request.created_at);
    const sortTime = Number.isNaN(created) ? 0 : created;

    if (request.status === "cancelled") {
      items.push({
        id: `request-${request.id}`,
        tone: "muted",
        title: "Request cancelled",
        detail: requestSummary(request),
        sortTime,
      });
    } else if (request.offer_count > 0 && isRequestUpcoming(request, now)) {
      items.push({
        id: `request-${request.id}`,
        tone: "offer",
        title: `${request.offer_count} cook ${
          request.offer_count === 1 ? "offer" : "offers"
        } received`,
        detail: requestSummary(request),
        sortTime,
      });
    } else {
      items.push({
        id: `request-${request.id}`,
        tone: "muted",
        title: "Request submitted",
        detail: requestSummary(request),
        sortTime,
      });
    }
  }

  for (const order of orders) {
    const timestamp = orderPickupTimestamp(order);
    const sortTime = Number.isNaN(timestamp) ? 0 : timestamp;
    const detail = `Pickup ${formatPickupDay(order.pickup_date)}${
      order.hub ? `, ${order.hub}` : ""
    }`;

    if (order.status === "confirmed") {
      items.push({ id: `order-${order.id}`, tone: "order", title: "Order confirmed", detail, sortTime });
    } else if (order.status === "ready") {
      items.push({ id: `order-${order.id}`, tone: "order", title: "Ready for pickup", detail, sortTime });
    } else if (order.status === "collected") {
      items.push({ id: `order-${order.id}`, tone: "done", title: "Meal collected", detail, sortTime });
    }
  }

  return items.sort((a, b) => b.sortTime - a.sortTime).slice(0, 4);
}