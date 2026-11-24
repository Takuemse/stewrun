
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { Caveat } from "next/font/google";
import { ArrowRight, Check, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import OrderRating from "@/components/order-rating";
import { fetchCustomerOrders, type CustomerOrder } from "@/lib/orders-client";
import { fetchCustomerName } from "@/lib/customer-activity-client";
import { MealLineBreakdown } from "@/components/meal-line-breakdown";

const script = Caveat({ subsets: ["latin"], weight: "600", display: "swap" });

const VALID_HUBS = ["Eastgate", "Joina City", "Avondale"] as const;

type PickupHub = (typeof VALID_HUBS)[number];

interface MealRequestItem {
  name: string;
  quantity: number;
}

interface MealRequest {
  id: string;
  items: MealRequestItem[];
  budget: number | null;
  hub: PickupHub;
  pickup_date: string;
  pickup_time: string;
  notes: string | null;
  status: string;
  created_at: string;
  offers_close_at: string | null;
  offer_count: number;
  order_status: string | null;
  cash_payment_status: "due" | "paid" | null;
}

export interface CookOfferItem {
  id: string;
  offer_id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface CookOffer {
  id: string;
  message: string | null;
  is_alternative: boolean;
  total_price: number;
  created_at: string;
  submitted_at: string | null;
  cook: {
    display_name: string | null;
    bio: string | null;
  } | null;
  items: CookOfferItem[];
}

interface OfferReviewData {
  offers: CookOffer[];
  negotiation: CustomerNegotiation | null;
}

interface CustomerNegotiation {
  id: string;
  offer_id: string;
  proposed_total: number | string;
  message: string | null;
  status: string;
  created_at: string;
  responded_at: string | null;
  agreed_total: number | string | null;
  response_message: string | null;
}

interface OfferReservation {
  order_id: string;
  amount_due: number;
  payment_method: "cash";
}

type RequestStage = "upcoming" | "past";

class RequestLoadError extends Error {
  unauthorized: boolean;

  constructor(message: string, unauthorized = false) {
    super(message);
    this.name = "RequestLoadError";
    this.unauthorized = unauthorized;
  }
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

function isValidMealRequest(value: unknown): value is MealRequest {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.id !== "string" ||
    !value.id.trim() ||
    !Array.isArray(value.items) ||
    value.items.length === 0 ||
    !VALID_HUBS.includes(value.hub as PickupHub) ||
    typeof value.pickup_date !== "string" ||
    !isValidDate(value.pickup_date) ||
    typeof value.pickup_time !== "string" ||
    !/^(0[0-9]|1\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(
      value.pickup_time,
    ) ||
    typeof value.status !== "string" ||
    typeof value.created_at !== "string" ||
    Number.isNaN(Date.parse(value.created_at)) ||
    (value.offers_close_at !== null &&
      (typeof value.offers_close_at !== "string" ||
        Number.isNaN(Date.parse(value.offers_close_at)))) ||
    typeof value.offer_count !== "number" ||
    !Number.isInteger(value.offer_count) ||
    value.offer_count < 0 ||
    (value.order_status !== null && typeof value.order_status !== "string") ||
    (value.cash_payment_status !== null &&
      value.cash_payment_status !== "due" &&
      value.cash_payment_status !== "paid")
  ) {
    return false;
  }

  if (
    value.budget !== null &&
    (typeof value.budget !== "number" ||
      !Number.isFinite(value.budget))
  ) {
    return false;
  }

  if (value.notes !== null && typeof value.notes !== "string") {
    return false;
  }

  return value.items.every(
    (item) =>
      isRecord(item) &&
      typeof item.name === "string" &&
      item.name.trim().length >= 2 &&
      typeof item.quantity === "number" &&
      Number.isInteger(item.quantity) &&
      item.quantity >= 1,
  );
}

async function fetchMealRequests(): Promise<MealRequest[]> {
  const response = await fetch("/api/meal-requests", {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new RequestLoadError(
      response.status === 401
        ? "Please sign in to view your meal requests."
        : "This page is available to customer accounts only.",
      true,
    );
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.requests) ||
    !payload.requests.every(isValidMealRequest)
  ) {
    throw new Error(
      "The meal requests response did not have the expected format.",
    );
  }

  return payload.requests;
}

function getPickupTimestamp(request: MealRequest): number {
  // Zimbabwe uses UTC+02:00. This avoids interpreting a database
  // date-only value in the visitor's local browser timezone.
  const pickupTime =
    request.pickup_time.length === 5
      ? `${request.pickup_time}:00`
      : request.pickup_time;

  return new Date(
    `${request.pickup_date}T${pickupTime}+02:00`,
  ).getTime();
}

function getRequestStage(
  request: MealRequest,
  currentTime: number | null,
): RequestStage {
  if (request.order_status === "collected" || request.status === "cancelled") {
    return "past";
  }

  // Until the client clock is available, avoid making a time-based decision.
  if (currentTime === null) {
    return "upcoming";
  }

  return getPickupTimestamp(request) <= currentTime
    ? "past"
    : "upcoming";
}

function formatPickupDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatPickupTime(time: string): string {
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${period}`;
}

function getOfferWindowLabel(
  request: MealRequest,
  currentTime: number | null,
): string {
  if (!request.offers_close_at) {
    return "Offer deadline unavailable";
  }

  if (currentTime === null) {
    return "Checking offer status";
  }

  return currentTime >= Date.parse(request.offers_close_at)
    ? "Offers closed"
    : "Accepting offers";
}

function getRequestSummary(request: MealRequest): string {
  return request.items
    .map((item) => `${item.quantity} × ${item.name}`)
    .join(", ");
}

function getErrorMessage(value: unknown): string {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error;
  }

  return "We could not load your meal requests. Please try again.";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isValidCookOfferItem(value: unknown): value is CookOfferItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.offer_id === "string" &&
    typeof value.name === "string" &&
    isNullableString(value.description) &&
    typeof value.quantity === "number" &&
    Number.isInteger(value.quantity) &&
    value.quantity > 0 &&
    typeof value.unit_price === "number" &&
    Number.isFinite(value.unit_price) &&
    typeof value.line_total === "number" &&
    Number.isFinite(value.line_total)
  );
}

function isValidCookOffer(value: unknown): value is CookOffer {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isNullableString(value.message) ||
    typeof value.is_alternative !== "boolean" ||
    typeof value.total_price !== "number" ||
    !Number.isFinite(value.total_price) ||
    typeof value.created_at !== "string" ||
    Number.isNaN(Date.parse(value.created_at)) ||
    !(
      value.submitted_at === null ||
      (typeof value.submitted_at === "string" &&
        !Number.isNaN(Date.parse(value.submitted_at)))
    ) ||
    !Array.isArray(value.items) ||
    !value.items.every(isValidCookOfferItem)
  ) {
    return false;
  }

  if (value.cook === null) {
    return true;
  }

  return (
    isRecord(value.cook) &&
    isNullableString(value.cook.display_name) &&
    isNullableString(value.cook.bio)
  );
}

function isValidCustomerNegotiation(
  value: unknown,
): value is CustomerNegotiation {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.offer_id === "string" &&
    (typeof value.proposed_total === "number" ||
      typeof value.proposed_total === "string") &&
    isNullableString(value.message) &&
    typeof value.status === "string" &&
    typeof value.created_at === "string" &&
    (value.responded_at === null || typeof value.responded_at === "string") &&
    (value.agreed_total === null ||
      typeof value.agreed_total === "number" ||
      typeof value.agreed_total === "string") &&
    isNullableString(value.response_message)
  );
}

async function fetchRequestOffers(requestId: string): Promise<OfferReviewData> {
  const response = await fetch(
    `/api/meal-requests/${encodeURIComponent(requestId)}/offers`,
    {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    },
  );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The server returned an unreadable offers response.");
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.offers) ||
    !payload.offers.every(isValidCookOffer) ||
    (payload.negotiation !== null &&
      !isValidCustomerNegotiation(payload.negotiation))
  ) {
    throw new Error("The offers response did not have the expected format.");
  }

  const negotiation =
    payload.negotiation === null ? null : payload.negotiation;

  return {
    offers: payload.offers,
    negotiation,
  };
}

async function createOfferReservation(
  offerId: string,
): Promise<OfferReservation> {
  const response = await fetch("/api/orders", {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ offer_id: offerId }),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The server returned an unreadable reservation response.");
  }

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error(
        "This offer cannot currently be reserved. It may no longer be available, or this request may already have an active reservation. Check My Orders for the latest status.",
      );
    }

    throw new Error(getErrorMessage(payload));
  }

  if (!isRecord(payload) || !isRecord(payload.reservation)) {
    throw new Error("The reservation response did not have the expected format.");
  }

  const reservation = payload.reservation;
  if (
    typeof reservation.order_id !== "string" ||
    typeof reservation.amount_due !== "number" ||
    !Number.isFinite(reservation.amount_due) ||
    reservation.amount_due <= 0 ||
    reservation.payment_method !== "cash"
  ) {
    throw new Error("The order response did not have the expected format.");
  }

  return {
    order_id: reservation.order_id,
    amount_due: reservation.amount_due,
    payment_method: "cash",
  };
}

function formatUsd(amount: number): string {
  return `USD ${amount.toFixed(2)}`;
}

function OrderPricingSummary({ order }: { order: CustomerOrder }) {
  const pricingValues = [
    order.meal_subtotal,
    order.original_offer_total,
    order.negotiated_discount,
    order.platform_fee,
  ];

  const hasCompleteBreakdown = pricingValues.every((value) => {
    if (value === null || value === undefined || value === "") {
      return false;
    }

    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0;
  });

  return (
    <section
      className="mt-4 border-t border-ink-900/10 pt-4"
      aria-label="Order price breakdown"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-900/50">
        Price breakdown
      </h3>

      {hasCompleteBreakdown && (
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-900/65">Original offer subtotal</dt>
            <dd className="font-medium tabular-nums text-ink-900">
              {formatUsd(Number(order.original_offer_total))}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-900/65">Negotiated discount</dt>
            <dd className="font-medium tabular-nums text-sage-600">
              −{formatUsd(Number(order.negotiated_discount))}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-ink-900/10 pt-3">
            <dt className="font-medium text-ink-900">
              Agreed meal subtotal
            </dt>
            <dd className="font-semibold tabular-nums text-ink-900">
              {formatUsd(Number(order.meal_subtotal))}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-900/65">Platform fee</dt>
            <dd className="font-medium tabular-nums text-ink-900">
              {formatUsd(Number(order.platform_fee))}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-3 flex items-center justify-between gap-4 border-t border-ink-900/10 pt-3">
        <span className="font-semibold text-ink-900">Total due</span>
        <span className="text-lg font-semibold tabular-nums text-ink-900">
          {formatUsd(Number(order.total))}
        </span>
      </div>
    </section>
  );
}

function getOfferPricePerPlate(offer: CookOffer): number {
  const quantity = Math.max(
    1,
    offer.items.reduce((sum, item) => sum + item.quantity, 0),
  );
  return offer.total_price / quantity;
}

function formatHarareDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function NegotiationStatus({
  offer,
  negotiation,
}: {
  offer: CookOffer;
  negotiation: CustomerNegotiation | null;
}) {
  if (!negotiation || negotiation.offer_id !== offer.id) return null;

  return (
    <div className="mt-4 rounded-md border border-ink-900/10 bg-cream-50 p-3">
      <p className="text-sm font-semibold capitalize text-ink-900">
        Existing counter-offer {negotiation.status}
      </p>
      <p className="mt-1 text-sm text-ink-900/70">
        Proposed total: {formatUsd(Number(negotiation.proposed_total))}
      </p>
      {negotiation.status === "accepted" &&
        negotiation.agreed_total !== null && (
          <p className="mt-1 text-sm font-medium text-sage-700">
            Agreed total: {formatUsd(Number(negotiation.agreed_total))}
          </p>
        )}
      {negotiation.response_message && (
        <p className="mt-2 text-sm leading-5 text-ink-900/70">
          Cook&apos;s response: {negotiation.response_message}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Lunch Journal helpers (presentation only)
   ───────────────────────────────────────────────────────────────────────── */

/** Orders are classified explicitly. Anything else is never called history. */
type OrderGroup = "active" | "past" | "unknown";

function classifyOrder(order: CustomerOrder): OrderGroup {
  if (order.status === "confirmed" || order.status === "ready") return "active";
  if (order.status === "collected") return "past";
  return "unknown";
}

function getOrderTimestamp(order: CustomerOrder): number {
  return new Date(
    `${order.pickup_date ?? "1970-01-01"}T${order.pickup_time ?? "00:00"}+02:00`,
  ).getTime();
}

function orderDateLabel(order: CustomerOrder): string {
  return order.pickup_date && isValidDate(order.pickup_date)
    ? formatPickupDate(order.pickup_date)
    : "Date pending";
}

function orderTimeLabel(order: CustomerOrder): string {
  return order.pickup_time && /^\d{2}:\d{2}/.test(order.pickup_time)
    ? formatPickupTime(order.pickup_time)
    : "Time pending";
}

function orderItemsSummary(order: CustomerOrder): string {
  return (
    order.items?.map((item) => `${item.quantity} × ${item.name}`).join(", ") ||
    "Reserved meal"
  );
}

/** Builds the Ziva prompt for "Request again". Only uses saved meal names. */
function buildRepeatHref(
  items: { name: string; quantity: number }[] | undefined,
): string | null {
  if (!items || items.length === 0) return null;
  const parts = items.map(
    (item) =>
      `${item.quantity} ${item.quantity === 1 ? "plate" : "plates"} of ${item.name}`,
  );
  const prompt = `I want ${parts.join(" and ")}.`.slice(0, 500);
  return `/dashboard?meal=${encodeURIComponent(prompt)}`;
}

const lunchStyles = `
  .ml-wrap{max-width:1280px;margin:0 auto;padding:16px 16px 40px}
  .ml-grid{display:grid;gap:24px}
  .ml-main,.ml-side{display:flex;flex-direction:column;gap:24px;min-width:0}
  .ml-section{display:flex;flex-direction:column;gap:12px}
  .ml-label{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4F5B45;margin:0}
  .ml-h1{margin:4px 0 0;font-size:32px;line-height:1.08}
  .ml-script{margin:14px 0 0;font-size:28px;line-height:1.05;transform:rotate(-3deg);transform-origin:left}
  .ml-script i{display:block;width:100%;height:3px;border-radius:2px;background:#E8A030;margin-top:4px}
  .ml-tabs{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
  .ml-tab{min-height:46px;padding:0 24px;border:0;border-radius:999px;background:#fff;
    font-size:15px;font-weight:600;color:#2A211C;cursor:pointer;
    box-shadow:0 2px 6px rgba(120,70,30,.08)}
  .ml-tab[aria-pressed="true"]{background:#B4472B;color:#fff}
  .ml-tab:focus-visible{outline:2px solid #B4472B;outline-offset:3px}
  .ml-card{background:#fff;border-radius:24px;padding:20px;
    box-shadow:0 10px 28px rgba(120,70,30,.10)}
  .ml-card.is-muted{background:#FDF9F3;box-shadow:none;border:1px solid rgba(42,33,28,.08)}
  .ml-row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
  .ml-grow{flex:1 1 240px;min-width:0}
  .ml-date{flex:none;width:68px;border-radius:16px;background:#FBE6CC;text-align:center;
    padding:8px 0;display:flex;flex-direction:column;line-height:1.1}
  .ml-date span{font-size:11px;font-weight:700;letter-spacing:.1em;color:#7A4A00}
  .ml-date b{font-size:28px;font-weight:500;color:#2A211C}
  .ml-date.is-small{width:56px}.ml-date.is-small b{font-size:22px}
  .ml-chip{display:inline-flex;align-items:center;padding:5px 12px;border-radius:999px;
    font-size:12px;font-weight:600}
  .ml-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
    gap:10px 20px;margin:14px 0 0}
  .ml-facts dt{font-size:11px;color:#6B5E55}
  .ml-facts dd{margin:2px 0 0;font-size:14px;font-weight:600;color:#2A211C}
  .ml-code{flex:1 1 100%;background:#FDF4E9;border-radius:18px;padding:14px 18px;text-align:center}
  .ml-code-num{margin:4px 0;font-family:ui-monospace,monospace;font-size:34px;font-weight:700;
    letter-spacing:.16em;color:#B4472B}
  .ml-copy{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;
    border:0;background:none;font-size:13px;font-weight:600;color:#B4472B;cursor:pointer}
  .ml-copy:focus-visible{outline:2px solid #B4472B;outline-offset:2px;border-radius:8px}
  .ml-steps{position:relative;display:grid;grid-template-columns:repeat(3,1fr);
    list-style:none;margin:26px 0 4px;padding:0;text-align:center}
  .ml-steps::before{content:"";position:absolute;left:16.667%;right:16.667%;top:13px;
    border-top:2px solid #E7DACB}
  .ml-steps::after{content:"";position:absolute;left:16.667%;top:13px;
    border-top:2px solid #B4472B;width:calc(66.667% * var(--p,0))}
  .ml-dot{position:relative;z-index:1;width:26px;height:26px;margin:0 auto 6px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;background:#fff;
    border:2px solid #CFC2B4;color:#B4472B}
  .ml-dot.is-done{background:#B4472B;border-color:#B4472B;color:#fff}
  .ml-dot.is-current{border:3px solid #E8A030}
  .ml-step-label{font-size:12.5px;color:#6B5E55}
  .ml-step-label.is-on{font-weight:700;color:#2A211C}
  .ml-cols{display:grid;gap:0 28px;margin-top:18px}
  .ml-offers{background:#FDF4E9;border-radius:16px;padding:10px 16px;text-align:center;min-width:130px}
  .ml-offers b{display:block;font-size:30px;line-height:1.1;color:#B4472B}
  .ml-offers span{font-size:13px;font-weight:600}
  .ml-sidecol{display:flex;flex:1 1 100%;flex-direction:column;gap:10px}
  .ml-journal{display:grid;gap:14px;grid-template-columns:1fr}
  .ml-entry{display:flex;gap:14px;align-items:flex-start;background:#fff;border-radius:20px;
    padding:16px;box-shadow:0 8px 20px rgba(120,70,30,.08)}
  .ml-entry details summary{cursor:pointer;font-size:13px;font-weight:600;color:#B4472B;
    min-height:44px;display:flex;align-items:center}
  .ml-entry details summary:focus-visible{outline:2px solid #B4472B;outline-offset:2px}
  .ml-aside-card{background:#FDF4E9;border-radius:24px;padding:18px}
  .ml-btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:50px;
    padding:0 20px;border-radius:999px;border:2px solid transparent;font-size:15px;
    font-weight:600;text-decoration:none}
  .ml-btn:focus-visible{outline:2px solid #B4472B;outline-offset:3px}
  .ml-btn-solid{background:#B4472B;color:#fff}
  .ml-btn-outline{border-color:#B4472B;color:#B4472B}
  .ml-glance{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;text-align:center}
  .ml-glance div{background:#fff;border-radius:14px;padding:12px 4px}
  .ml-glance b{display:block;font-size:26px;line-height:1.1;color:#B4472B}
  .ml-glance span{font-size:12px}
  @media (min-width:480px){
    .ml-code{flex:0 0 auto;min-width:200px}
    .ml-sidecol{flex:0 0 190px}
  }
  @media (min-width:640px){
    .ml-wrap{padding:24px 24px 40px}
    .ml-h1{font-size:40px}
    .ml-card{padding:24px}
    .ml-date{width:76px}.ml-date b{font-size:32px}
    .ml-cols{grid-template-columns:1fr 1fr}
    .ml-journal{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
  }
  @media (min-width:1024px){
    .ml-wrap{padding:64px 32px 48px}
    .ml-h1{font-size:46px}
  }
  @media (min-width:1280px){
    .ml-wrap{padding-top:16px}
    .ml-grid{grid-template-columns:minmax(0,1fr) 300px;gap:28px;align-items:start}
    .ml-side{padding-top:56px}
  }
`;

function DateBlock({
  date,
  small = false,
}: {
  date: string | null | undefined;
  small?: boolean;
}) {
  let parts: { weekday: string; day: string; month: string } | null = null;

  if (date && isValidDate(date)) {
    const [year, month, day] = date.split("-").map(Number);
    const when = new Date(Date.UTC(year, month - 1, day, 12));
    const format = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Harare",
        ...options,
      }).format(when);
    parts = {
      weekday: format({ weekday: "short" }).toUpperCase(),
      day: format({ day: "numeric" }),
      month: format({ month: "short" }).toUpperCase(),
    };
  }

  return (
    <div
      aria-hidden="true"
      className={`ml-date${small ? " is-small" : ""}`}
    >
      <span>{parts?.weekday ?? "DATE"}</span>
      <b className="font-display">{parts?.day ?? "–"}</b>
      <span>{parts?.month ?? "TBC"}</span>
    </div>
  );
}

function CopyCodeButton({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button type="button" className="ml-copy" onClick={() => void copy()}>
      {state === "copied" ? (
        <Check aria-hidden="true" className="size-4" />
      ) : (
        <Copy aria-hidden="true" className="size-4" />
      )}
      {state === "copied"
        ? "Copied"
        : state === "failed"
          ? "Copy unavailable"
          : "Copy code"}
      <span className="sr-only" role="status">
        {state === "copied" ? "Pickup code copied" : ""}
      </span>
    </button>
  );
}

const orderSteps = ["Confirmed", "Ready", "Collected"] as const;

function OrderProgress({ status }: { status: string }) {
  const current = status === "collected" ? 2 : status === "ready" ? 1 : 0;
  const progress = current / 2;

  return (
    <ol
      className="ml-steps"
      aria-label="Order progress"
      style={{ "--p": progress } as CSSProperties}
    >
      {orderSteps.map((label, index) => {
        const done = index < current || (status === "collected" && index === 2);
        const isCurrent = index === current && !done;
        return (
          <li key={label} aria-current={index === current ? "step" : undefined}>
            <span
              aria-hidden="true"
              className={`ml-dot${done ? " is-done" : ""}${isCurrent ? " is-current" : ""}`}
            >
              {done && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className={`ml-step-label${index === current ? " is-on" : ""}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type LunchLoadResult = {
  requests: PromiseSettledResult<MealRequest[]>;
  orders: PromiseSettledResult<CustomerOrder[]>;
};

/** Loads requests and orders together, so Refresh updates both. */
async function loadLunchData(): Promise<LunchLoadResult> {
  const [requests, orders] = await Promise.allSettled([
    fetchMealRequests(),
    fetchCustomerOrders(),
  ]);
  return { requests, orders };
}

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<MealRequest[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "past">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Welcome back");

  // Keep the current time in state instead of reading Date.now() during render.
  // This also refreshes time-based request and offer labels once per minute.
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const updateClock = () => setCurrentTime(Date.now());

    updateClock();

    const interval = window.setInterval(updateClock, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("tab") === "past") {
        setTab("past");
      }
      const hour = new Date().getHours();
      setGreeting(
        hour >= 5 && hour < 12
          ? "Good morning"
          : hour >= 12 && hour < 18
            ? "Good afternoon"
            : "Good evening",
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchCustomerName().then((name) => {
      if (active) setFirstName(name?.split(/\s+/)[0] ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  const applyResults = useCallback((result: LunchLoadResult) => {
    if (result.requests.status === "fulfilled") {
      setRequests(result.requests.value);
      setError(null);
      setUnauthorized(false);
      setLastUpdated(new Date());
    } else {
      const reason: unknown = result.requests.reason;
      setError(
        reason instanceof Error
          ? reason.message
          : "Something went wrong while loading your requests.",
      );
      setUnauthorized(reason instanceof RequestLoadError && reason.unauthorized);
    }

    if (result.orders.status === "fulfilled") {
      setOrders(result.orders.value);
      setOrdersError(null);
    } else {
      const reason: unknown = result.orders.reason;
      setOrdersError(
        reason instanceof Error ? reason.message : "We could not load your orders.",
      );
    }

    setLoading(false);
    setOrdersLoading(false);
  }, []);

  // Initial page load: requests and orders together.
  useEffect(() => {
    let active = true;
    void loadLunchData().then((result) => {
      if (active) applyResults(result);
    });
    return () => {
      active = false;
    };
  }, [applyResults]);

  // Manual refresh: reloads requests AND orders.
  const refresh = useCallback(async () => {
    setLoading(true);
    setOrdersLoading(true);
    setError(null);
    setUnauthorized(false);
    applyResults(await loadLunchData());
  }, [applyResults]);

  const activeOrders = orders
    .filter((order) => classifyOrder(order) === "active")
    .sort((a, b) => getOrderTimestamp(a) - getOrderTimestamp(b));
  const unknownOrders = orders.filter((order) => classifyOrder(order) === "unknown");
  const collectedOrders = orders
    .filter((order) => classifyOrder(order) === "past")
    .sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a));
  const upcomingRequests = requests
    .filter(
      (request) =>
        request.order_status === null &&
        getRequestStage(request, currentTime) === "upcoming",
    )
    .sort((a, b) => getPickupTimestamp(a) - getPickupTimestamp(b));
  const pastRequests = requests
    .filter(
      (request) =>
        request.order_status === null &&
        getRequestStage(request, currentTime) === "past",
    )
    .sort((a, b) => getPickupTimestamp(b) - getPickupTimestamp(a));

  const activeCount = activeOrders.length + upcomingRequests.length;
  const offersToReview = upcomingRequests
    .filter((request) => request.status === "open")
    .reduce((sum, request) => sum + request.offer_count, 0);

  const readyOrder = activeOrders.some((order) => order.status === "ready");
  const tagline = readyOrder
    ? "Your lunch is ready for pickup."
    : activeOrders.length > 0
      ? "Your lunch is confirmed."
      : null;

  const everythingEmpty =
    !loading && !ordersLoading && !error && requests.length === 0 && orders.length === 0;

  return (
    <main className="min-h-screen bg-cream-50">
      <style>{lunchStyles}</style>

      <div className="ml-wrap">
        <div className="ml-grid">
          <div className="ml-main">
            <header>
              <p className="text-sm font-semibold text-clay-500">{greeting}</p>
              <h1
                className="ml-h1 font-display tracking-tight text-ink-900"
                style={{ overflowWrap: "anywhere" }}
              >
                {firstName ?? "Hello"},
                <span className="block text-clay-500">here’s your lunch journal.</span>
              </h1>
              <span
                aria-hidden="true"
                className="mt-4 block h-1 w-[102px] rounded-full bg-saffron-500"
              />
              {tagline && !loading && (
                <p className={`ml-script text-ink-900 ${script.className}`} style={{ display: "inline-block" }}>
                  {tagline}
                  <i />
                </p>
              )}
              <p className="mt-4 max-w-xl text-sm leading-6 text-ink-900/65 sm:text-base">
                See what needs your attention now, then find past meals when you need them.
              </p>
            </header>

            <div className="ml-tabs">
              {!loading && !error && !everythingEmpty && (
                <div className="ml-tabs" role="group" aria-label="Lunch history">
                  <button
                    type="button"
                    className="ml-tab"
                    aria-pressed={tab === "active"}
                    onClick={() => setTab("active")}
                  >
                    Active ({activeCount})
                  </button>
                  <button
                    type="button"
                    className="ml-tab"
                    aria-pressed={tab === "past"}
                    onClick={() => setTab("past")}
                  >
                    Past
                  </button>
                </div>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => void refresh()}
                disabled={loading}
                className="min-h-11"
                style={{ marginLeft: "auto", borderRadius: 999 }}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>

            {loading && (
              <div
                className="rounded-xl border border-ink-900/10 bg-white p-8 text-center"
                role="status"
              >
                <p className="font-medium text-ink-900">Loading your requests...</p>
                <p className="mt-2 text-sm text-ink-900/60">
                  Please wait while we retrieve your meal requests.
                </p>
              </div>
            )}

            {!loading && error && (
              <div
                role="alert"
                className="rounded-xl border border-clay-500/25 bg-white p-6"
              >
                <h2 className="font-display text-xl font-semibold text-ink-900">
                  We could not load your requests
                </h2>

                <p className="mt-2 text-sm leading-6 text-ink-900/70">{error}</p>

                <div className="mt-5 flex flex-wrap gap-3">
                  {unauthorized && (
                    <Link
                      href="/login"
                      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-clay-500 px-5 text-sm font-semibold text-cream-50 hover:opacity-90"
                    >
                      Sign in
                    </Link>
                  )}

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void refresh()}
                    disabled={loading}
                  >
                    Try again
                  </Button>
                </div>
              </div>
            )}

            {!loading && !error && ordersError && (
              <div
                role="alert"
                className="rounded-lg border border-clay-500/25 bg-white p-4 text-sm leading-6 text-ink-900/75"
              >
                Your requests loaded, but your orders did not. Use Refresh to try
                again. {ordersError}
              </div>
            )}

            {everythingEmpty && (
              <div className="ml-card text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-cream-50 text-xl text-clay-500">
                  +
                </div>

                <h2 className="mt-4 font-display text-2xl font-semibold text-ink-900">
                  No meal requests yet
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-900/65">
                  When you submit a meal request, it will appear here. You can
                  then keep track of cook offers and pickup details.
                </p>

                <Link
                  href="/start"
                  className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-clay-500 px-5 text-sm font-semibold text-cream-50 hover:opacity-90"
                >
                  Create your first request
                </Link>
              </div>
            )}

            {!loading && !error && !everythingEmpty && tab === "active" && (
              <>
                {activeOrders.length > 0 && (
                  <section className="ml-section" aria-labelledby="ml-orders-heading">
                    <h2 id="ml-orders-heading" className="ml-label">
                      Confirmed and ready
                    </h2>
                    {activeOrders.map((order) => (
                      <LunchOrderCard key={order.id} order={order} />
                    ))}
                  </section>
                )}

                {upcomingRequests.length > 0 && (
                  <section
                    id="ml-requests"
                    className="ml-section"
                    aria-labelledby="ml-requests-heading"
                  >
                    <h2 id="ml-requests-heading" className="ml-label">
                      Requests awaiting cook offers
                    </h2>
                    {upcomingRequests.map((request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        currentTime={currentTime}
                      />
                    ))}
                  </section>
                )}

                {unknownOrders.length > 0 && (
                  <section className="ml-section" aria-labelledby="ml-unknown-heading">
                    <h2 id="ml-unknown-heading" className="ml-label">
                      Needs attention
                    </h2>
                    {unknownOrders.map((order) => (
                      <UnknownOrderCard key={order.id} order={order} />
                    ))}
                  </section>
                )}

                {activeOrders.length === 0 &&
                  upcomingRequests.length === 0 &&
                  unknownOrders.length === 0 && (
                    <div className="ml-card text-center" style={{ borderStyle: "dashed" }}>
                      <h2 className="font-display text-xl font-semibold">
                        Nothing needs you right now
                      </h2>
                      <p className="mt-2 text-sm text-ink-900/65">
                        Start a request and compare offers from local cooks.
                      </p>
                    </div>
                  )}
              </>
            )}

            {!loading && !error && !everythingEmpty && tab === "past" && (
              <>
                {collectedOrders.length > 0 && (
                  <section className="ml-section" aria-labelledby="ml-collected-heading">
                    <h2 id="ml-collected-heading" className="ml-label">
                      Meals you collected
                    </h2>
                    <div className="ml-journal">
                      {collectedOrders.map((order) => (
                        <PastOrderEntry key={order.id} order={order} />
                      ))}
                    </div>
                  </section>
                )}

                {pastRequests.length > 0 && (
                  <section className="ml-section" aria-labelledby="ml-past-requests-heading">
                    <h2 id="ml-past-requests-heading" className="ml-label">
                      Requests that did not become orders
                    </h2>
                    {pastRequests.map((request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        currentTime={currentTime}
                      />
                    ))}
                  </section>
                )}

                {collectedOrders.length === 0 && pastRequests.length === 0 && (
                  <div className="ml-card text-center" style={{ borderStyle: "dashed" }}>
                    <h2 className="font-display text-xl font-semibold">No past meals yet</h2>
                    <p className="mt-2 text-sm text-ink-900/65">
                      Completed meals and older requests will appear here.
                    </p>
                  </div>
                )}
              </>
            )}

            {!loading && !error && lastUpdated && (
              <p className="text-xs text-ink-900/50">
                Last updated:{" "}
                {lastUpdated.toLocaleTimeString("en-GB", {
                  timeZone: "Africa/Harare",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                Harare time
              </p>
            )}
          </div>

          <aside className="ml-side" aria-label="Lunch summary and shortcuts">
            <section className="ml-aside-card" aria-labelledby="ml-actions-heading">
              <h2 id="ml-actions-heading" className="font-display text-xl text-ink-900">
                Quick actions
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                <Link href="/dashboard" className="ml-btn ml-btn-solid">
                  Start a lunch request
                </Link>
                {offersToReview > 0 && !loading && tab === "active" && (
                  <a href="#ml-requests" className="ml-btn ml-btn-outline">
                    Review my offers ({offersToReview})
                  </a>
                )}
              </div>
            </section>

            <section className="ml-aside-card" aria-labelledby="ml-glance-heading">
              <h2 id="ml-glance-heading" className="font-display text-xl text-ink-900">
                At a glance
              </h2>
              <div className="ml-glance">
                <div>
                  <b className="font-display">{loading ? "–" : activeCount}</b>
                  <span>Active</span>
                </div>
                <div>
                  <b className="font-display">{loading ? "–" : offersToReview}</b>
                  <span>Offers</span>
                </div>
                <div>
                  <b className="font-display">{loading ? "–" : collectedOrders.length}</b>
                  <span>Collected</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-ink-900 p-5 text-cream-50" aria-labelledby="ml-ziva-heading">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-saffron-500">
                Ask Ziva
              </p>
              <h2 id="ml-ziva-heading" className="mt-1.5 font-display text-xl">
                Planning another lunch?
              </h2>
              <p className="mt-1 text-sm text-cream-50/80">Tell Ziva what you would like.</p>
              <Link
                href="/dashboard"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-saffron-500 px-5 text-sm font-semibold text-ink-900 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream-50"
              >
                Ask Ziva
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function LunchOrderCard({ order }: { order: CustomerOrder }) {
  const cashDue = order.cash_payment_status === "due";
  const cashPaid = order.cash_payment_status === "paid";
  const pickupCodeEligible = order.status === "ready" && Boolean(order.pickup_code);

  return (
    <article className="ml-card">
      <div className="ml-row">
        <DateBlock date={order.pickup_date} />

        <div className="ml-grow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="ml-label">Your active lunch</p>
            <span
              className="ml-chip"
              style={{ background: "#FBE6CC", color: "#7A4A00" }}
            >
              {order.status === "ready" ? "Ready for pickup" : "Confirmed"}
            </span>
          </div>
          <h2
            className="mt-1.5 font-display text-2xl capitalize leading-snug tracking-tight text-ink-900 sm:text-3xl"
            style={{ overflowWrap: "anywhere" }}
          >
            {order.items?.map((item) => item.name).join(", ") || "Reserved meal"}
          </h2>
          {order.cook_display_name && (
            <p className="mt-1 text-sm text-ink-900/70">From {order.cook_display_name}</p>
          )}

          <dl className="ml-facts">
            <div>
              <dt>Pickup hub</dt>
              <dd>{order.hub || "Hub not available"}</dd>
            </div>
            <div>
              <dt>Pickup date</dt>
              <dd>{orderDateLabel(order)}</dd>
            </div>
            <div>
              <dt>Pickup time</dt>
              <dd>{orderTimeLabel(order)}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>
                {cashDue
                  ? "Cash to cook at pickup"
                  : cashPaid
                    ? "Cash paid to cook"
                    : order.payment_status}
              </dd>
            </div>
          </dl>
        </div>

        {pickupCodeEligible ? (
          <div className="ml-code">
            <p className="ml-label">Show your cook this pickup code</p>
            <p className="ml-code-num">{order.pickup_code}</p>
            <CopyCodeButton code={order.pickup_code as string} />
          </div>
        ) : (
          order.status === "confirmed" && (
            <p className="max-w-[16rem] text-xs leading-5 text-ink-900/65">
              Your pickup code appears here when your cook marks the order ready.
            </p>
          )
        )}
      </div>

      <OrderProgress status={order.status} />

      <div className="ml-cols">
        {order.items && order.items.length > 0 ? (
          <section className="mt-4 border-t border-ink-900/10 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-900/50">
              Meal items
            </h3>
            <MealLineBreakdown items={order.items} />
          </section>
        ) : (
          <div />
        )}
        <OrderPricingSummary order={order} />
      </div>
    </article>
  );
}

function UnknownOrderCard({ order }: { order: CustomerOrder }) {
  return (
    <article className="ml-card" style={{ border: "1px solid rgba(232,160,48,.6)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="ml-label">Order</p>
        <span className="ml-chip" style={{ background: "#FBE6CC", color: "#7A4A00" }}>
          Status: {order.status}
        </span>
      </div>
      <h2
        className="mt-1.5 font-display text-xl leading-snug text-ink-900"
        style={{ overflowWrap: "anywhere" }}
      >
        {orderItemsSummary(order)}
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-900/70">
        We do not recognise this order status yet, so it is not shown as active
        or completed. Your order details are below.
      </p>
      <dl className="ml-facts">
        <div>
          <dt>Pickup hub</dt>
          <dd>{order.hub || "Hub not available"}</dd>
        </div>
        <div>
          <dt>Pickup date</dt>
          <dd>{orderDateLabel(order)}</dd>
        </div>
        <div>
          <dt>Pickup time</dt>
          <dd>{orderTimeLabel(order)}</dd>
        </div>
      </dl>
      <OrderPricingSummary order={order} />
    </article>
  );
}

function PastOrderEntry({ order }: { order: CustomerOrder }) {
  const cashPaid = order.cash_payment_status === "paid";
  const repeatHref = buildRepeatHref(order.items);

  return (
    <article className="ml-entry">
      <DateBlock date={order.pickup_date} small />

      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          className="font-display text-lg leading-snug text-ink-900"
          style={{ overflowWrap: "anywhere" }}
        >
          {orderItemsSummary(order)}
        </h3>
        <p className="mt-1 text-xs leading-5 text-ink-900/65">
          {order.cook_display_name ? `From ${order.cook_display_name} · ` : ""}
          {order.hub || "Hub not available"} · {orderDateLabel(order)}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="ml-chip" style={{ background: "#E3EFDD", color: "#2F5B2A" }}>
            Collected
          </span>
          <span className="text-sm font-semibold tabular-nums text-ink-900">
            {formatUsd(Number(order.total))} {cashPaid ? "paid" : "total"}
          </span>
        </div>

        <details>
          <summary>Meal and price details</summary>
          {order.items && order.items.length > 0 && (
            <MealLineBreakdown items={order.items} />
          )}
          <OrderPricingSummary order={order} />
        </details>

        {order.status === "collected" && cashPaid && (
          <div className="mt-3">
            <OrderRating orderId={order.id} />
          </div>
        )}

        {repeatHref && (
          <Link
            href={repeatHref}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-clay-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Request again
          </Link>
        )}
      </div>
    </article>
  );
}

function RequestCard({
  request,
  currentTime,
}: {
  request: MealRequest;
  currentTime: number | null;
}) {
  const stage = getRequestStage(request, currentTime);
  const offerWindow = getOfferWindowLabel(request, currentTime);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [offerData, setOfferData] = useState<OfferReviewData | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [reservingOfferId, setReservingOfferId] = useState<string | null>(null);
  const [reservation, setReservation] = useState<OfferReservation | null>(null);
  const [reservedOfferId, setReservedOfferId] = useState<string | null>(null);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState(request.status);
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  const reservationLock = useRef(false);

  const loadOffers = useCallback(async () => {
    setOffersLoading(true);
    setOffersError(null);
    try {
      setOfferData(await fetchRequestOffers(request.id));
    } catch (loadError) {
      setOffersError(
        loadError instanceof Error
          ? loadError.message
          : "We could not load these offers. Please try again.",
      );
    } finally {
      setOffersLoading(false);
    }
  }, [request.id]);

  async function toggleOfferReview() {
    if (reviewOpen) {
      setReviewOpen(false);
      return;
    }

    setReviewOpen(true);
    if (!offerData && !offersLoading) {
      await loadOffers();
    }
  }

  async function handleReserveOffer(offerId: string) {
    const acceptedNegotiation = offerData?.negotiation;
    if (
      reservationLock.current ||
      reservation ||
      !canReserve ||
      acceptedNegotiation?.status === "pending" ||
      (acceptedNegotiation?.status === "accepted" &&
        acceptedNegotiation.offer_id !== offerId)
    ) {
      return;
    }

    reservationLock.current = true;
    setReservingOfferId(offerId);
    setReservationError(null);
    try {
      setReservation(await createOfferReservation(offerId));
      setReservedOfferId(offerId);
    } catch (reserveError) {
      setReservationError(
        reserveError instanceof Error
          ? reserveError.message
          : "We could not reserve this offer. Please try again.",
      );
    } finally {
      reservationLock.current = false;
      setReservingOfferId(null);
    }
  }

  async function handleCancelRequest() {
    if (cancelling || activeStatus !== "open") return;

    setCancelling(true);
    setCancellationError(null);
    try {
      const response = await fetch(
        `/api/meal-requests/${encodeURIComponent(request.id)}`,
        { method: "DELETE", headers: { Accept: "application/json" } },
      );
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Unable to cancel this meal request.",
        );
      }
      if (!isRecord(payload) || payload.status !== "cancelled") {
        throw new Error("The cancellation response was invalid.");
      }
      setActiveStatus("cancelled");
      setCancelPromptOpen(false);
    } catch (cancelError) {
      setCancellationError(
        cancelError instanceof Error
          ? cancelError.message
          : "Unable to cancel this meal request.",
      );
    } finally {
      setCancelling(false);
    }
  }

  const canReserve =
    activeStatus === "open" &&
    stage === "upcoming" &&
    offerData?.negotiation?.status !== "pending";
  const requestAlreadySelected = activeStatus === "offer_selected";
  const isCancelled = activeStatus === "cancelled";
  const repeatHref = buildRepeatHref(request.items);

  const stageLabel = isCancelled
    ? "Cancelled"
    : stage === "upcoming"
      ? "Upcoming pickup"
      : request.order_status === "collected"
        ? "Collected"
        : "Past request";
  const stageChipStyle =
    stage === "upcoming" && !isCancelled
      ? { background: "#E3EFDD", color: "#2F5B2A" }
      : { background: "#EEE6DC", color: "#5E524A" };

  return (
    <div className={`ml-card${stage === "past" ? " is-muted" : ""}`}>
      <div className="ml-row">
        <DateBlock date={request.pickup_date} />

        <div className="ml-grow">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="break-all font-mono text-xs text-ink-900/60">
              <span className="sr-only">Request reference </span>
              {request.id}
            </p>
            <span className="ml-chip" style={stageChipStyle}>
              {stageLabel}
            </span>
          </div>

          <h3
            className="mt-2 font-display text-xl leading-snug tracking-tight text-ink-900 sm:text-2xl"
            style={{ overflowWrap: "anywhere" }}
          >
            <span className="sr-only">Requested meals: </span>
            {getRequestSummary(request)}
          </h3>

          <dl className="ml-facts">
            <div>
              <dt>Pickup hub</dt>
              <dd>{request.hub}</dd>
            </div>
            <div>
              <dt>Pickup date</dt>
              <dd>{formatPickupDate(request.pickup_date)}</dd>
            </div>
            <div>
              <dt>Pickup time</dt>
              <dd>{formatPickupTime(request.pickup_time)}</dd>
            </div>
            <div>
              <dt>Budget per plate</dt>
              <dd>
                {request.budget === null
                  ? "Not set"
                  : `${formatUsd(request.budget)} per plate`}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-xs leading-5 text-ink-900/65">
            {stage === "past"
              ? request.order_status === "collected"
                ? request.cash_payment_status === "paid"
                  ? "Meal collected · cash payment recorded."
                  : "Meal collected."
                : "Scheduled pickup time has passed."
              : offerWindow}
            {stage === "upcoming" &&
              request.offers_close_at &&
              currentTime !== null &&
              currentTime < Date.parse(request.offers_close_at) &&
              ` · Offers close ${formatHarareDateTime(request.offers_close_at)}`}
            {" · "}
            {activeStatus === "open"
              ? "Request submitted"
              : activeStatus === "cancelled"
                ? "Cancelled by you"
                : activeStatus}
          </p>
        </div>

        <div className="ml-sidecol">
          <div className="ml-offers">
            <b className="font-display">{request.offer_count}</b>
            <span>{request.offer_count === 1 ? "cook offer" : "cook offers"}</span>
          </div>

          {request.offer_count > 0 && (
            <Button
              type="button"
              variant={stage === "upcoming" ? undefined : "secondary"}
              aria-expanded={reviewOpen}
              aria-controls={reviewOpen ? `offers-${request.id}` : undefined}
              onClick={() => void toggleOfferReview()}
              className="w-full"
              style={{ minHeight: 46, borderRadius: 999 }}
            >
              {reviewOpen ? "Close offers" : "Review offers"}
            </Button>
          )}

          {stage === "past" && repeatHref && (
            <Link
              href={repeatHref}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold text-clay-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Request again
            </Link>
          )}
        </div>
      </div>

      {activeStatus === "open" && !reservation && (
        <div className="mt-3">
          {cancelPromptOpen ? (
            <div className="rounded-md border border-clay-500/20 bg-cream-50 p-4">
              <p className="text-sm font-semibold text-ink-900">
                Cancel this meal request?
              </p>
              <p className="mt-1 text-xs leading-5 text-ink-900/65">
                Cooks will be told the request is no longer available.
              </p>
              {cancellationError && (
                <p className="mt-2 text-sm text-clay-500" role="alert">
                  {cancellationError}
                </p>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={cancelling}
                  onClick={() => setCancelPromptOpen(false)}
                >
                  Keep request
                </Button>
                <Button
                  type="button"
                  disabled={cancelling}
                  onClick={() => void handleCancelRequest()}
                  className="bg-clay-500"
                >
                  {cancelling ? "Cancelling..." : "Confirm cancellation"}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCancelPromptOpen(true)}
              className="min-h-11 text-sm font-semibold text-clay-500 underline decoration-clay-500/40 underline-offset-4 hover:decoration-clay-500"
            >
              Cancel request
            </button>
          )}
        </div>
      )}

      {reviewOpen && (
        <section
          id={`offers-${request.id}`}
          aria-label={`Offers for pickup on ${formatPickupDate(request.pickup_date)}`}
          className="mt-5 border-t border-ink-900/10 pt-5"
        >
          <div className="rounded-lg bg-cream-50 p-4 sm:p-5">
            <h4 className="font-display text-lg font-semibold text-ink-900">
              Pickup details
            </h4>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-900/60">Pickup hub</dt>
                <dd className="mt-1 font-semibold text-ink-900">{request.hub}</dd>
              </div>
              <div>
                <dt className="text-ink-900/60">Pickup date and time</dt>
                <dd className="mt-1 font-semibold text-ink-900">
                  {formatPickupDate(request.pickup_date)} at{" "}
                  {formatPickupTime(request.pickup_time)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-ink-900/60">Offer submission deadline</dt>
                <dd className="mt-1 font-semibold text-ink-900">
                  {request.offers_close_at
                    ? formatHarareDateTime(request.offers_close_at)
                    : "Unavailable"}
                </dd>
                <p className="mt-1 text-xs leading-5 text-ink-900/60">
                  This is when cooks stop submitting offers; it is not a
                  reservation expiry time.
                </p>
              </div>
            </dl>
          </div>

          {requestAlreadySelected && (
            <div
              role="status"
              className="mt-4 rounded-lg border border-saffron-500/30 bg-saffron-500/10 p-4 text-sm leading-6 text-ink-900"
            >
              An offer has already been selected for this request, so another
              reservation cannot be started here. Check{" "}
              <Link
                href="/orders"
                className="font-semibold text-clay-500 underline underline-offset-2"
              >
                My Orders
              </Link>{" "}
              for its latest status.
            </div>
          )}

          {reservation && (
            <div
              role="status"
              className="mt-4 rounded-lg border border-sage-500/30 bg-sage-500/10 p-4"
            >
              <h4 className="font-semibold text-ink-900">
                Order confirmed
              </h4>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-900/60">Order reference</dt>
                  <dd className="mt-1 break-all font-mono text-xs font-semibold text-ink-900">
                    {reservation.order_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-900/60">Amount due</dt>
                  <dd className="mt-1 font-semibold text-ink-900">
                    {formatUsd(reservation.amount_due)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-sm leading-6 text-ink-900/70">
                Your order is confirmed. Bring the exact amount and pay the
                cook in cash when you collect your meal at the selected hub.
                You will receive a pickup code when the cook marks the order
                ready.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/orders"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-clay-500 px-5 text-sm font-semibold text-cream-50 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                >
                  View My Orders
                </Link>
              </div>
            </div>
          )}

          {reservationError && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-clay-500/25 bg-clay-500/5 p-4 text-sm leading-6 text-ink-900"
            >
              <p>{reservationError}</p>
              {reservationError.includes("Check My Orders") && (
                <Link
                  href="/orders"
                  className="mt-2 inline-flex min-h-11 items-center font-semibold text-clay-500 underline underline-offset-2"
                >
                  Go to My Orders
                </Link>
              )}
            </div>
          )}

          {offersLoading && (
            <p role="status" className="mt-5 text-sm text-ink-900/65">
              Loading cook offers…
            </p>
          )}

          {offersError && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-clay-500/25 bg-white p-4"
            >
              <p className="text-sm leading-6 text-ink-900">{offersError}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void loadOffers()}
                disabled={offersLoading}
                className="mt-3"
              >
                Try again
              </Button>
            </div>
          )}

          {!offersLoading && !offersError && offerData?.offers.length === 0 && (
            <p className="mt-5 rounded-lg border border-dashed border-ink-900/20 p-5 text-sm leading-6 text-ink-900/65">
              No submitted offers are currently available to review. The offer
              count may have changed since this page was loaded.
            </p>
          )}

          {!offersLoading &&
            !offersError &&
            offerData &&
            offerData.offers.length > 0 && (
              <div className="mt-5 grid gap-4">
                {!canReserve && !requestAlreadySelected && (
                  <p className="rounded-lg border border-ink-900/10 bg-white p-4 text-sm leading-6 text-ink-900/70">
                    {activeStatus !== "open"
                      ? "This request is no longer open for a new reservation."
                      : "The scheduled pickup time has passed, so an offer cannot be reserved."}{" "}
                    Check{" "}
                    <Link
                      href="/orders"
                      className="font-semibold text-clay-500 underline underline-offset-2"
                    >
                      My Orders
                    </Link>{" "}
                    for any existing order.
                  </p>
                )}
                <p className="rounded-lg bg-cream-50 p-4 text-sm leading-6 text-ink-900/70">
                  Cooks set their own prices. Your budget is a guide; compare
                  the meal and full price, then choose the offer you prefer.
                </p>
                {[...offerData.offers]
                  .sort((first, second) => {
                    if (first.is_alternative !== second.is_alternative) {
                      return first.is_alternative ? 1 : -1;
                    }
                    return getOfferPricePerPlate(first) - getOfferPricePerPlate(second);
                  })
                  .map((offer) => {
                    const acceptedOfferTotal =
                      offerData.negotiation?.status === "accepted" &&
                      offerData.negotiation.offer_id === offer.id &&
                      offerData.negotiation.agreed_total !== null
                        ? Number(offerData.negotiation.agreed_total)
                        : offer.total_price;
                    const offeredPlateCount = Math.max(
                      1,
                      offer.items.reduce((sum, item) => sum + item.quantity, 0),
                    );
                    const offeredPricePerPlate =
                      acceptedOfferTotal / offeredPlateCount;
                    const budgetComparison =
                      request.budget === null
                        ? null
                        : Math.round(
                            (offeredPricePerPlate - request.budget) * 100,
                          );
                    const canReserveThisOffer =
                      canReserve &&
                      (offerData.negotiation?.status !== "accepted" ||
                        offerData.negotiation.offer_id === offer.id);

                    return (
                      <article
                        key={offer.id}
                        className="rounded-lg border border-ink-900/10 bg-white p-4 sm:p-5"
                      >
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div>
                            <h4 className="font-display text-xl font-semibold text-ink-900">
                              {offer.cook?.display_name || "Cook name unavailable"}
                            </h4>
                            {offer.is_alternative && (
                              <span className="mt-2 inline-flex rounded-md bg-saffron-500/15 px-2.5 py-1 text-xs font-semibold text-ink-900">
                                Alternative offer
                              </span>
                            )}
                            {offer.cook?.bio && (
                              <p className="mt-1 text-sm leading-6 text-ink-900/70">
                                {offer.cook.bio}
                              </p>
                            )}
                          </div>
                          <p className="text-lg font-semibold text-ink-900">
                            {formatUsd(offeredPricePerPlate)} / plate
                          </p>
                          <p className="mt-1 text-xs text-ink-900/60">
                            {offeredPlateCount} {offeredPlateCount === 1 ? "plate" : "plates"}
                            {budgetComparison === null
                              ? " · No budget set"
                              : budgetComparison < 0
                                ? " · Below budget"
                                : budgetComparison > 0
                                  ? " · Above budget"
                                  : " · Matches budget"}
                          </p>
                        </div>

                        <div className="mt-4 border-t border-ink-900/10 pt-4">
                          <h5 className="text-sm font-semibold text-ink-900">
                            Offer message
                          </h5>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink-900/70">
                            {offer.message || "No message provided."}
                          </p>
                          {offer.submitted_at && (
                            <p className="mt-2 text-xs text-ink-900/55">
                              Submitted{" "}
                              {formatHarareDateTime(offer.submitted_at)}
                            </p>
                          )}
                        </div>

                        <div className="mt-4">
                          <h5 className="text-sm font-semibold text-ink-900">
                            Meal items
                          </h5>
                          <MealLineBreakdown
                            items={offer.items}
                            showDescription={true}
                          />
                        </div>

                        <NegotiationStatus
                          offer={offer}
                          negotiation={offerData.negotiation}
                        />

                        <div className="mt-3 flex flex-col gap-3 border-t border-ink-900/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm">
                            <p className="font-semibold text-ink-900">
                              {offerData.negotiation?.status === "accepted" &&
                              offerData.negotiation.offer_id === offer.id
                                ? "Agreed meal price: "
                                : "Meal price: "}
                              {formatUsd(acceptedOfferTotal)}
                            </p>
                            <p className="mt-1 text-xs text-ink-900/60">
                              StewRun fee: {formatUsd(0.1)} · Total if reserved:{" "}
                              {formatUsd(acceptedOfferTotal + 0.1)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            disabled={
                              !canReserveThisOffer ||
                              Boolean(reservation) ||
                              reservingOfferId !== null
                            }
                            onClick={() => void handleReserveOffer(offer.id)}
                            className="w-full sm:w-auto"
                          >
                            {reservingOfferId === offer.id
                              ? "Confirming order…"
                              : reservation
                                ? offer.id === reservedOfferId
                                  ? "Order confirmed"
                                  : "Order confirmation in progress"
                                : requestAlreadySelected
                                  ? "Reservation already in progress"
                                  : !canReserveThisOffer
                                    ? "Not available to reserve"
                                    : "Choose this offer"}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
              </div>
            )}
        </section>
      )}
    </div>
  );
}
