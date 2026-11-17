
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import OrderRating from "@/components/order-rating";
import { fetchCustomerOrders, type CustomerOrder } from "@/lib/orders-client";

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

interface CookOfferItem {
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

function getRequestStage(request: MealRequest): RequestStage {
  if (request.order_status === "collected" || request.status === "cancelled") {
    return "past";
  }

  return getPickupTimestamp(request) <= Date.now()
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

function getOfferWindowLabel(request: MealRequest): string {
  if (!request.offers_close_at) {
    return "Offer deadline unavailable";
  }

  return Date.now() >= Date.parse(request.offers_close_at)
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

function getOfferPricePerPlate(offer: CookOffer): number {
  const quantity = Math.max(1, ...offer.items.map((item) => item.quantity));
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

  // Initial page load.
  // State updates happen only after the asynchronous request completes.
  useEffect(() => {
    let active = true;

    async function loadInitialRequests() {
      try {
        const loadedRequests = await fetchMealRequests();

        if (!active) {
          return;
        }

        setRequests(loadedRequests);
        setError(null);
        setUnauthorized(false);
        setLastUpdated(new Date());
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Something went wrong while loading your requests.",
        );

        setUnauthorized(
          loadError instanceof RequestLoadError &&
            loadError.unauthorized,
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInitialRequests();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchCustomerOrders().then((loadedOrders) => {
      if (active) {
        setOrders(loadedOrders);
        setOrdersError(null);
      }
    }).catch((loadError: unknown) => {
      if (active) setOrdersError(loadError instanceof Error ? loadError.message : "We could not load your orders.");
    }).finally(() => { if (active) setOrdersLoading(false); });
    return () => { active = false; };
  }, []);

  // Manual refresh handler, used by the page buttons.
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnauthorized(false);

    try {
      const loadedRequests = await fetchMealRequests();

      setRequests(loadedRequests);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Something went wrong while loading your requests.",
      );

      setUnauthorized(
        loadError instanceof RequestLoadError &&
          loadError.unauthorized,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const visibleRequests = requests
    .filter((request) => request.order_status === null)
    .filter((request) => (tab === "active" ? getRequestStage(request) === "upcoming" : getRequestStage(request) === "past"))
    .sort(
      (a, b) => tab === "active"
        ? getPickupTimestamp(a) - getPickupTimestamp(b)
        : getPickupTimestamp(b) - getPickupTimestamp(a),
    );
  const visibleOrders = orders
    .filter((order) => tab === "active" ? order.status === "confirmed" || order.status === "ready" : order.status !== "confirmed" && order.status !== "ready")
    .sort((first, second) => {
      const firstTime = new Date(`${first.pickup_date ?? "1970-01-01"}T${first.pickup_time ?? "00:00"}+02:00`).getTime();
      const secondTime = new Date(`${second.pickup_date ?? "1970-01-01"}T${second.pickup_time ?? "00:00"}+02:00`).getTime();
      return tab === "active" ? firstTime - secondTime : secondTime - firstTime;
    });

  return (
    <main className="min-h-screen bg-cream-50">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
              Your StewRun activity
            </p>

            <h1 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
              My Lunch
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-ink-900/65 sm:text-base">
              See what needs your attention now, then find past meals when you need them.
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void loadRequests()} disabled={loading} className="min-h-11 self-start sm:self-auto">
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {!loading && !error && !(!ordersLoading && requests.length === 0 && orders.length === 0) && (
          <div className="mt-8 inline-flex rounded-lg border border-ink-900/10 bg-white p-1" role="group" aria-label="Lunch history">
            {(["active", "past"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`min-h-10 rounded-md px-4 text-sm font-semibold capitalize ${tab === value ? "bg-ink-900 text-white" : "text-ink-900/65 hover:bg-cream-50"}`}>
                {value === "active" ? `Active (${orders.filter((order) => order.status === "confirmed" || order.status === "ready").length + requests.filter((request) => request.order_status === null && getRequestStage(request) === "upcoming").length})` : "Past"}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div
            className="mt-10 rounded-xl border border-ink-900/10 bg-white p-8 text-center"
            role="status"
          >
            <p className="font-medium text-ink-900">
              Loading your requests...
            </p>
            <p className="mt-2 text-sm text-ink-900/60">
              Please wait while we retrieve your meal requests.
            </p>
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="mt-10 rounded-xl border border-clay-500/25 bg-white p-6"
          >
            <h2 className="font-display text-xl font-semibold text-ink-900">
              We could not load your requests
            </h2>

            <p className="mt-2 text-sm leading-6 text-ink-900/70">
              {error}
            </p>

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
                onClick={() => void loadRequests()}
                disabled={loading}
              >
                Try again
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && ordersError && (
          <div role="alert" className="mt-5 rounded-lg border border-clay-500/25 bg-white p-4 text-sm leading-6 text-ink-900/75">
            Your requests loaded, but your orders did not. Refresh the page to retry. {ordersError}
          </div>
        )}

        {!loading && !ordersLoading && !error && requests.length === 0 && orders.length === 0 && (
          <Card className="mt-10 border border-ink-900/10 text-center shadow-none">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-cream-50 text-xl text-clay-500">
              +
            </div>

            <h2 className="mt-4 font-display text-2xl font-semibold text-ink-900">
              No meal requests yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-900/65">
              When you submit a meal request, it will appear here.
              You can then keep track of cook offers and pickup details.
            </p>

            <Link
              href="/start"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-clay-500 px-5 text-sm font-semibold text-cream-50 hover:opacity-90"
            >
              Create your first request
            </Link>
          </Card>
        )}

        {!loading && !error && !(!ordersLoading && requests.length === 0 && orders.length === 0) && (
          <div className="mt-6 space-y-5">
            {visibleOrders.map((order) => <LunchOrderCard key={order.id} order={order} />)}
            {visibleRequests.map((request) => <RequestCard key={request.id} request={request} />)}
            {visibleOrders.length === 0 && visibleRequests.length === 0 && (
              <Card className="border border-dashed border-ink-900/15 p-8 text-center shadow-none">
                <h2 className="font-display text-xl font-semibold">{tab === "active" ? "Nothing needs you right now" : "No past meals yet"}</h2>
                <p className="mt-2 text-sm text-ink-900/65">{tab === "active" ? "Start a request and compare offers from local cooks." : "Completed meals and older requests will appear here."}</p>
              </Card>
            )}
          </div>
        )}

        {!loading && !error && lastUpdated && (
          <p className="mt-10 text-xs text-ink-900/50">
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
    </main>
  );
}

function LunchOrderCard({ order }: { order: CustomerOrder }) {
  const cashDue = order.cash_payment_status === "due";
  const cashPaid = order.cash_payment_status === "paid";
  const pickupCodeEligible = order.status === "ready" && Boolean(order.pickup_code);
  return (
    <Card className="border border-ink-900/10 bg-white p-5 shadow-none sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sage-600">{order.status === "collected" ? "Past meal" : "Your active lunch"}</p>
          <h2 className="mt-1 font-display text-xl font-semibold capitalize">{order.items?.map((item) => item.name).join(", ") || "Reserved meal"}</h2>
        </div>
        <span className="rounded-full bg-cream-100 px-3 py-1.5 text-xs font-semibold capitalize">{order.status === "ready" ? "Ready for pickup" : order.status === "collected" ? "Collected" : "Confirmed"}</span>
      </div>
      <div className="mt-4 grid gap-3 border-y border-ink-900/10 py-4 text-sm sm:grid-cols-3">
        <p><span className="block text-xs text-ink-900/55">Pickup</span><span className="mt-1 block font-medium">{order.hub || "Hub not available"} · {order.pickup_date || "Date pending"} · {order.pickup_time || "Time pending"}</span></p>
        <p><span className="block text-xs text-ink-900/55">Total</span><span className="mt-1 block font-semibold">${Number(order.total).toFixed(2)} USD</span></p>
        <p><span className="block text-xs text-ink-900/55">Payment</span><span className="mt-1 block font-medium">{cashDue ? "Cash to cook at pickup" : cashPaid ? "Cash paid to cook" : order.payment_status}</span></p>
      </div>
      {pickupCodeEligible && <div className="mt-4 rounded-lg border border-sage-500/30 bg-sage-500/10 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-ink-900/60">Show your cook this pickup code</p><p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em]">{order.pickup_code}</p></div>}
      {order.status === "collected" && cashPaid && <div className="mt-4"><OrderRating orderId={order.id} /></div>}
    </Card>
  );
}

function RequestCard({ request }: { request: MealRequest }) {
  const stage = getRequestStage(request);
  const offerWindow = getOfferWindowLabel(request);
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

  return (
    <Card className="border border-ink-900/10 p-5 shadow-none sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-900/50">
            Request reference
          </p>

          <p className="mt-1 break-all font-mono text-xs text-ink-900/70">
            {request.id}
          </p>
        </div>

        <span
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
            stage === "upcoming"
              ? "bg-sage-500/10 text-sage-500"
              : "bg-ink-900/5 text-ink-900/60"
          }`}
        >
          {stage === "upcoming"
            ? "Upcoming pickup"
            : request.order_status === "collected"
              ? "Collected"
              : "Past request"}
        </span>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-900/50">
          Requested meals
        </h3>

        <p className="mt-2 text-base font-semibold leading-6 text-ink-900">
          {getRequestSummary(request)}
        </p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-cream-50 p-3">
          <dt className="text-xs text-ink-900/55">Pickup hub</dt>
          <dd className="mt-1 text-sm font-semibold text-ink-900">
            {request.hub}
          </dd>
        </div>

        <div className="rounded-lg bg-cream-50 p-3">
          <dt className="text-xs text-ink-900/55">Pickup date</dt>
          <dd className="mt-1 text-sm font-semibold text-ink-900">
            {formatPickupDate(request.pickup_date)}
          </dd>
        </div>

        <div className="rounded-lg bg-cream-50 p-3">
          <dt className="text-xs text-ink-900/55">Pickup time</dt>
          <dd className="mt-1 text-sm font-semibold text-ink-900">
            {formatPickupTime(request.pickup_time)}
          </dd>
        </div>

      <div className="rounded-lg bg-cream-50 p-3">
        <dt className="text-xs text-ink-900/55">Budget per plate</dt>
        <dd className="mt-1 text-sm font-semibold text-ink-900">
          {request.budget === null
            ? "Not set"
            : `${formatUsd(request.budget)} per plate`}
        </dd>
      </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-900/10 pt-4">
        <div>
          <p className="text-sm font-semibold text-ink-900">
            {request.offer_count}{" "}
            {request.offer_count === 1 ? "cook offer" : "cook offers"}
          </p>

          <p className="mt-1 text-xs text-ink-900/60">
            {stage === "past"
              ? request.order_status === "collected"
                ? request.cash_payment_status === "paid"
                  ? "Meal collected · cash payment recorded."
                  : "Meal collected."
                : "Scheduled pickup time has passed."
              : offerWindow}
          </p>
        </div>

        <span className="text-xs text-ink-900/50">
          {activeStatus === "open"
            ? "Request submitted"
            : activeStatus === "cancelled"
              ? "Cancelled by you"
              : activeStatus}
        </span>
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
              className="min-h-10 text-sm font-semibold text-clay-500 underline decoration-clay-500/40 underline-offset-4 hover:decoration-clay-500"
            >
              Cancel request
            </button>
          )}
        </div>
      )}

      {request.offer_count > 0 && (
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            aria-expanded={reviewOpen}
            aria-controls={reviewOpen ? `offers-${request.id}` : undefined}
            onClick={() => void toggleOfferReview()}
            className="w-full sm:w-auto"
          >
            {reviewOpen ? "Close offers" : "Review offers"}
          </Button>
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
                    ...offer.items.map((item) => item.quantity),
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
                      <ul className="mt-2 divide-y divide-ink-900/10">
                        {offer.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                          >
                            <div>
                              <p className="font-medium text-ink-900">
                                {item.quantity} × {item.name}
                              </p>
                              {item.description && (
                                <p className="mt-1 text-xs leading-5 text-ink-900/60">
                                  {item.description}
                                </p>
                              )}
                              <p className="mt-1 text-xs text-ink-900/60">
                                Unit price {formatUsd(item.unit_price)}
                              </p>
                            </div>
                            <p className="font-semibold text-ink-900">
                              {formatUsd(item.line_total)}
                            </p>
                          </li>
                        ))}
                      </ul>
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
                          StewRun fee: {formatUsd(0.1)} · Total if reserved: {formatUsd(acceptedOfferTotal + 0.1)}
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
    </Card>
  );
}
