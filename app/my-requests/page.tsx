
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    value.offer_count < 0
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

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<MealRequest[]>([]);
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

  const upcomingRequests = requests
    .filter((request) => getRequestStage(request) === "upcoming")
    .sort(
      (a, b) =>
        getPickupTimestamp(a) - getPickupTimestamp(b),
    );

  const pastRequests = requests
    .filter((request) => getRequestStage(request) === "past")
    .sort(
      (a, b) =>
        getPickupTimestamp(b) - getPickupTimestamp(a),
    );

  return (
    <main className="min-h-screen bg-cream-50">
      <header className="border-b border-ink-900/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
            aria-label="StewRun home"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-clay-500 font-display text-xl font-semibold text-cream-50">
              S
            </span>

            <span className="font-display text-xl font-semibold tracking-tight text-ink-900">
              StewRun
            </span>
          </Link>

          <Link
            href="/"
            className="text-sm font-semibold text-ink-900 hover:text-clay-500"
          >
            Create a request
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
              Your StewRun activity
            </p>

            <h1 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
              My requests
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-ink-900/65 sm:text-base">
              Keep track of your meal requests, pickup arrangements
              and cook offers.
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadRequests()}
            disabled={loading}
            className="min-h-11 self-start sm:self-auto"
          >
            {loading ? "Refreshing..." : "Refresh requests"}
          </Button>
        </div>

        {!loading && !error && (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Total requests"
              value={requests.length}
            />
            <SummaryCard
              label="Upcoming"
              value={upcomingRequests.length}
            />
            <SummaryCard
              label="Past"
              value={pastRequests.length}
            />
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

        {!loading && !error && requests.length === 0 && (
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
              href="/"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-clay-500 px-5 text-sm font-semibold text-cream-50 hover:opacity-90"
            >
              Create your first request
            </Link>
          </Card>
        )}

        {!loading && !error && requests.length > 0 && (
          <div className="mt-10 space-y-12">
            <RequestSection
              title="Upcoming requests"
              description="Meal requests with pickup times that have not passed."
              requests={upcomingRequests}
              emptyMessage="You have no upcoming meal requests."
            />

            <RequestSection
              title="Past requests"
              description="Your previous requests, including pickups whose scheduled times have passed."
              requests={pastRequests}
              emptyMessage="Your past requests will appear here."
            />
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

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <Card className="border border-ink-900/10 p-4 shadow-none sm:p-5">
      <p className="text-xs font-medium text-ink-900/60 sm:text-sm">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold text-ink-900">
        {value}
      </p>
    </Card>
  );
}

function RequestSection({
  title,
  description,
  requests,
  emptyMessage,
}: {
  title: string;
  description: string;
  requests: MealRequest[];
  emptyMessage: string;
}) {
  return (
    <section aria-labelledby={title.toLowerCase().replaceAll(" ", "-")}>
      <div className="mb-5">
        <h2
          id={title.toLowerCase().replaceAll(" ", "-")}
          className="font-display text-2xl font-semibold tracking-tight text-ink-900"
        >
          {title}
        </h2>

        <p className="mt-1 text-sm text-ink-900/60">
          {description}
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-900/20 px-5 py-8 text-center">
          <p className="text-sm text-ink-900/60">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </section>
  );
}

function RequestCard({ request }: { request: MealRequest }) {
  const stage = getRequestStage(request);
  const offerWindow = getOfferWindowLabel(request);

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
          {stage === "upcoming" ? "Upcoming pickup" : "Past request"}
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
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-900/10 pt-4">
        <div>
          <p className="text-sm font-semibold text-ink-900">
            {request.offer_count}{" "}
            {request.offer_count === 1 ? "cook offer" : "cook offers"}
          </p>

          <p className="mt-1 text-xs text-ink-900/60">
            {stage === "past"
              ? "Scheduled pickup time has passed."
              : offerWindow}
          </p>
        </div>

        <span className="text-xs text-ink-900/50">
          {request.status === "open" ? "Request submitted" : request.status}
        </span>
      </div>
    </Card>
  );
}
