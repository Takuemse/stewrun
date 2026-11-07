
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type MealRequestItem = {
  name: string;
  quantity: number;
};

type MealRequest = {
  id: string;
  items: MealRequestItem[];
  budget: number | null;
  hub: string;
  pickup_date: string;
  pickup_time: string;
  notes: string | null;
  created_at: string;
  offers_close_at: string | null;
};

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
};

type OfferDraftItem = {
  key: string;
  menu_item_id: string | null;
  name: string;
  description: string;
  quantity: string;
  unit_price: string;
};

type RequestsResponse = {
  requests?: MealRequest[];
  error?: string;
};

type MenuResponse = {
  menu?: MenuItem[];
  error?: string;
};

type SubmissionResponse = {
  offer?: {
    offer_id: string;
    request_id: string;
    status: string;
    total_price: number;
  };
  error?: string;
};

function formatPickupDate(date: string) {
  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-ZW", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsedDate);
}

function formatPickupTime(time: string) {
  return time.slice(0, 5);
}

function formatDeadline(deadline: string | null) {
  if (!deadline) return null;

  const parsedDate = new Date(deadline);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-ZW", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
}

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function createDraftKey() {
  return globalThis.crypto.randomUUID();
}

async function fetchCookRequests(): Promise<MealRequest[]> {
  const response = await fetch("/api/cook/requests", {
    method: "GET",
    cache: "no-store",
  });

  const result: RequestsResponse = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Unable to load meal requests.");
  }

  return result.requests ?? [];
}

export default function CookPage() {
  const [requests, setRequests] = useState<MealRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [menuRetry, setMenuRetry] = useState(0);

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );

  const [draftItems, setDraftItems] = useState<OfferDraftItem[]>([]);
  const [menuSelection, setMenuSelection] = useState("");
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedRequest =
    requests.find((request) => request.id === selectedRequestId) ?? null;

  const offerTotal = draftItems.reduce((total, item) => {
    const quantity = Number(item.quantity);
    const price = Number(item.unit_price);

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(price) ||
      quantity <= 0 ||
      price <= 0
    ) {
      return total;
    }

    return total + quantity * price;
  }, 0);

  // Load requests when the page first mounts.
  useEffect(() => {
    let cancelled = false;

    async function loadInitialRequests() {
      try {
        const loadedRequests = await fetchCookRequests();

        if (!cancelled) {
          setRequests(loadedRequests);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while loading requests.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialRequests();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load the cook's available menu when the offer composer is opened.
  useEffect(() => {
    if (!selectedRequestId || menuLoaded) {
      return;
    }

    const controller = new AbortController();

    async function loadMenu() {
      try {
        const response = await fetch("/api/cook/menu", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const result: MenuResponse = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load your menu.");
        }

        if (!controller.signal.aborted) {
          setMenu(result.menu ?? []);
          setMenuLoaded(true);
          setMenuLoading(false);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setMenuError(
            err instanceof Error
              ? err.message
              : "Unable to load your menu.",
          );
          setMenuLoading(false);
        }
      }
    }

    void loadMenu();

    return () => {
      controller.abort();
    };
  }, [selectedRequestId, menuLoaded, menuRetry]);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");

    try {
      const loadedRequests = await fetchCookRequests();
      setRequests(loadedRequests);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading requests.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  function handlePrepareOffer(request: MealRequest) {
    setSelectedRequestId(request.id);
    setDraftItems([]);
    setMenuSelection("");
    setMessage("");
    setSubmissionError("");
    setSuccess("");

    if (!menuLoaded) {
      setMenuLoading(true);
      setMenuError("");
    }
  }

  function handleCloseComposer() {
    setSelectedRequestId(null);
    setDraftItems([]);
    setMenuSelection("");
    setMessage("");
    setSubmissionError("");
  }

  function handleAddMenuItem(menuItemId: string) {
    const selectedMenuItem = menu.find(
      (item) => item.id === menuItemId,
    );

    if (!selectedMenuItem) {
      return;
    }

    if (draftItems.length >= 20) {
      setSubmissionError("An offer cannot contain more than 20 items.");
      return;
    }

    if (draftItems.some((item) => item.menu_item_id === menuItemId)) {
      return;
    }

    setDraftItems((current) => [
      ...current,
      {
        key: createDraftKey(),
        menu_item_id: selectedMenuItem.id,
        name: selectedMenuItem.name,
        description: selectedMenuItem.description ?? "",
        quantity: "1",
        unit_price: String(selectedMenuItem.price),
      },
    ]);

    setSubmissionError("");
    setMenuSelection("");
  }

  function handleAddCustomMeal() {
    if (draftItems.length >= 20) {
      setSubmissionError("An offer cannot contain more than 20 items.");
      return;
    }

    setDraftItems((current) => [
      ...current,
      {
        key: createDraftKey(),
        menu_item_id: null,
        name: "",
        description: "",
        quantity: "1",
        unit_price: "",
      },
    ]);

    setSubmissionError("");
  }

  function updateDraftItem(
    key: string,
    updates: Partial<OfferDraftItem>,
  ) {
    setDraftItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, ...updates } : item,
      ),
    );

    setSubmissionError("");
  }

  function removeDraftItem(key: string) {
    setDraftItems((current) =>
      current.filter((item) => item.key !== key),
    );

    setSubmissionError("");
  }

  function validateDraft(): string | null {
    if (!selectedRequest) {
      return "Please select a meal request.";
    }

    if (draftItems.length < 1) {
      return "Add at least one meal to your offer.";
    }

    if (draftItems.length > 20) {
      return "An offer cannot contain more than 20 items.";
    }

    if (message.length > 1000) {
      return "Your message cannot exceed 1000 characters.";
    }

    for (const item of draftItems) {
      const quantity = Number(item.quantity);
      const price = Number(item.unit_price);

      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 20
      ) {
        return "Each meal quantity must be a whole number between 1 and 20.";
      }

      if (
        !/^\d+(\.\d{1,2})?$/.test(item.unit_price.trim()) ||
        !Number.isFinite(price) ||
        price <= 0 ||
        price > 99999999.99
      ) {
        return "Each meal needs a positive price with no more than two decimal places.";
      }

      if (item.menu_item_id === null) {
        if (item.name.trim().length < 2 || item.name.trim().length > 150) {
          return "Custom meal names must contain between 2 and 150 characters.";
        }

        if (item.description.length > 500) {
          return "Meal descriptions cannot exceed 500 characters.";
        }
      }
    }

    if (offerTotal > 99999999.99) {
      return "The offer total exceeds the permitted amount.";
    }

    return null;
  }

  async function handleSubmitOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || !selectedRequest) {
      return;
    }

    const validationError = validateDraft();

    if (validationError) {
      setSubmissionError(validationError);
      return;
    }

    setSubmitting(true);
    setSubmissionError("");
    setSuccess("");

    const payload = {
      request_id: selectedRequest.id,
      message: message.trim() || null,
      items: draftItems.map((item) => {
        if (item.menu_item_id) {
          return {
            menu_item_id: item.menu_item_id,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
          };
        }

        return {
          menu_item_id: null,
          name: item.name.trim(),
          description: item.description.trim() || null,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
        };
      }),
    };

    try {
      const response = await fetch("/api/cook/offers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result: SubmissionResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to submit your offer.");
      }

      if (!result.offer) {
        throw new Error("The server did not confirm your offer submission.");
      }

      setSuccess("Your offer has been submitted successfully.");

      // Remove this request because this cook has submitted an offer for it.
      setRequests((current) =>
        current.filter((request) => request.id !== selectedRequest.id),
      );

      setSelectedRequestId(null);
      setDraftItems([]);
      setMenuSelection("");
      setMessage("");
    } catch (err) {
      setSubmissionError(
        err instanceof Error
          ? err.message
          : "Something went wrong while submitting your offer.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream-50">
      <header className="border-b border-ink-900/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="font-display text-2xl font-semibold text-ink-900"
          >
            StewRun
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-ink-900/60 sm:inline">
              Cook workspace
            </span>

            <Link
              href="/"
              className="text-sm font-medium text-ink-900 hover:text-clay-500"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-clay-500">
              Cook workspace
            </p>

            <h1 className="font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
              Meal requests
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-900/60">
              Browse customer requests, review their pickup details and
              prepare an offer using your menu or custom meals.
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={loading || refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh requests"}
          </Button>
        </div>

        {success && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-sage-500/30 bg-sage-500/10 p-4 text-sm text-sage-500"
          >
            {success}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between border-b border-ink-900/10 pb-4">
          <div>
            <h2 className="font-semibold text-ink-900">
              Open requests
            </h2>

            <p className="mt-1 text-sm text-ink-900/50">
              {requests.length} available
            </p>
          </div>
        </div>

        {loading && (
          <Card>
            <p className="text-sm text-ink-900/60">
              Loading meal requests...
            </p>
          </Card>
        )}

        {!loading && error && (
          <Card>
            <div className="space-y-3">
              <h3 className="font-semibold text-ink-900">
                Unable to load requests
              </h3>

              <p className="text-sm text-red-700">{error}</p>

              {error === "Authentication required." && (
                <Link
                  href="/login"
                  className="inline-block text-sm font-medium text-clay-500 underline"
                >
                  Sign in to continue
                </Link>
              )}

              <div>
                <Button onClick={handleRefresh} disabled={refreshing}>
                  Try again
                </Button>
              </div>
            </div>
          </Card>
        )}

        {!loading && !error && requests.length === 0 && (
          <Card className="py-12 text-center">
            <div className="mx-auto max-w-md">
              <h3 className="font-display text-xl font-semibold text-ink-900">
                No open requests yet
              </h3>

              <p className="mt-3 text-sm leading-6 text-ink-900/60">
                New customer meal requests will appear here when they
                become available. Check back shortly.
              </p>

              <Button
                variant="secondary"
                className="mt-6"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? "Checking..." : "Check again"}
              </Button>
            </div>
          </Card>
        )}

        {!loading && !error && requests.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2">
            {requests.map((request) => (
              <Card key={request.id} className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-clay-500">
                      Meal request
                    </p>

                    <h3 className="mt-1 font-display text-xl font-semibold text-ink-900">
                      {request.hub}
                    </h3>
                  </div>

                  <span className="rounded-md bg-sage-500/10 px-3 py-1 text-xs font-medium text-sage-500">
                    Open
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-y border-ink-900/10 py-4">
                  <div>
                    <p className="text-xs text-ink-900/50">
                      Pickup date
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {formatPickupDate(request.pickup_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-ink-900/50">
                      Pickup time
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {formatPickupTime(request.pickup_time)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-ink-900/50">
                      Customer budget
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {request.budget !== null
                        ? formatMoney(Number(request.budget))
                        : "Not specified"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-ink-900/50">
                      Requested meals
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {request.items.length} item types
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-semibold text-ink-900">
                    Requested food
                  </h4>

                  <ul className="space-y-2">
                    {request.items.map((item, index) => (
                      <li
                        key={`${request.id}-${index}`}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <span className="text-ink-900/80">
                          {item.name}
                        </span>

                        <span className="font-medium">
                          × {item.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {request.notes && (
                  <div className="rounded-lg bg-cream-50 p-3">
                    <p className="text-xs font-medium text-ink-900/50">
                      Customer notes
                    </p>

                    <p className="mt-1 text-sm leading-5 text-ink-900/80">
                      {request.notes}
                    </p>
                  </div>
                )}

                {request.offers_close_at && (
                  <p className="text-xs text-ink-900/50">
                    Offers close:{" "}
                    {formatDeadline(request.offers_close_at) ??
                      "Deadline unavailable"}
                  </p>
                )}

                <details className="border-t border-ink-900/10 pt-4">
                  <summary className="cursor-pointer text-sm font-medium text-clay-500">
                    View request details
                  </summary>

                  <div className="mt-3 space-y-2 text-xs text-ink-900/50">
                    <p>Request ID: {request.id}</p>

                    <p>
                      Submitted:{" "}
                      {new Date(request.created_at).toLocaleString("en-ZW")}
                    </p>
                  </div>
                </details>

                <Button
                  className="w-full"
                  onClick={() => handlePrepareOffer(request)}
                  disabled={submitting}
                >
                  {selectedRequestId === request.id
                    ? "Offer selected"
                    : "Prepare offer"}
                </Button>
              </Card>
            ))}
          </div>
        )}

        {selectedRequest && (
          <section className="mt-10" aria-labelledby="offer-heading">
            <Card className="space-y-6">
              <form onSubmit={handleSubmitOffer} className="space-y-6">
                <div className="flex flex-col justify-between gap-3 border-b border-ink-900/10 pb-5 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-clay-500">
                      Offer composer
                    </p>

                    <h2
                      id="offer-heading"
                      className="mt-1 font-display text-2xl font-semibold text-ink-900"
                    >
                      Prepare your offer
                    </h2>

                    <p className="mt-2 text-sm text-ink-900/60">
                      For the {selectedRequest.hub} request, with pickup on{" "}
                      {formatPickupDate(selectedRequest.pickup_date)} at{" "}
                      {formatPickupTime(selectedRequest.pickup_time)}.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCloseComposer}
                    disabled={submitting}
                  >
                    Close
                  </Button>
                </div>

                <div>
                  <h3 className="font-semibold text-ink-900">
                    Add meals to your offer
                  </h3>

                  <p className="mt-1 text-sm text-ink-900/60">
                    Select an available menu item or add a custom meal.
                    You set the price for this particular request.
                  </p>

                  {menuLoading && (
                    <p className="mt-4 text-sm text-ink-900/60">
                      Loading your menu...
                    </p>
                  )}

                  {menuError && (
                    <div className="mt-4 rounded-lg border border-red-700/20 bg-red-50 p-3">
                      <p className="text-sm text-red-700">{menuError}</p>

                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-3"
                        onClick={() => {
                          setMenuError("");
                          setMenuLoading(true);
                          setMenuRetry((current) => current + 1);
                        }}
                      >
                        Retry menu
                      </Button>
                    </div>
                  )}

                  {!menuLoading && !menuError && menuLoaded && (
                    <div className="mt-4">
                      {menu.length > 0 ? (
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <select
                            value={menuSelection}
                            onChange={(event) => {
                              const id = event.target.value;

                              if (id) {
                                handleAddMenuItem(id);
                              }
                            }}
                            className="min-h-11 flex-1 rounded-lg border border-ink-900/20 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-clay-500"
                          >
                            <option value="">Choose a menu item...</option>

                            {menu.map((item) => {
                              const alreadyAdded = draftItems.some(
                                (draft) => draft.menu_item_id === item.id,
                              );

                              return (
                                <option
                                  key={item.id}
                                  value={item.id}
                                  disabled={alreadyAdded}
                                >
                                  {item.name} — {formatMoney(Number(item.price))}
                                  {alreadyAdded ? " (Added)" : ""}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      ) : (
                        <p className="text-sm text-ink-900/60">
                          You have no available saved menu items. You can
                          still create an offer using custom meals.
                        </p>
                      )}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3"
                    onClick={handleAddCustomMeal}
                    disabled={draftItems.length >= 20 || submitting}
                  >
                    Add custom meal
                  </Button>
                </div>

                <div className="border-t border-ink-900/10 pt-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-ink-900">
                      Your offer items
                    </h3>

                    <span className="text-xs text-ink-900/50">
                      {draftItems.length} / 20 items
                    </span>
                  </div>

                  {draftItems.length === 0 && (
                    <div className="rounded-lg bg-cream-50 p-6 text-center">
                      <p className="text-sm text-ink-900/60">
                        No meals added yet. Choose a saved menu item or
                        create a custom meal.
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {draftItems.map((item, index) => {
                      const quantity = Number(item.quantity);
                      const price = Number(item.unit_price);
                      const subtotal =
                        Number.isFinite(quantity) &&
                        Number.isFinite(price) &&
                        quantity > 0 &&
                        price > 0
                          ? quantity * price
                          : 0;

                      return (
                        <div
                          key={item.key}
                          className="rounded-xl border border-ink-900/10 p-4"
                        >
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wider text-clay-500">
                                Offer item {index + 1}
                              </p>

                              <p className="mt-1 text-sm text-ink-900/50">
                                {item.menu_item_id
                                  ? "Saved menu item"
                                  : "Custom meal"}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeDraftItem(item.key)}
                              disabled={submitting}
                              className="text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>

                          {item.menu_item_id ? (
                            <div>
                              <p className="font-medium text-ink-900">
                                {item.name}
                              </p>

                              {item.description && (
                                <p className="mt-1 text-sm text-ink-900/60">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div>
                                <label
                                  htmlFor={`meal-name-${item.key}`}
                                  className="mb-1 block text-sm font-medium text-ink-900"
                                >
                                  Meal name
                                </label>

                                <Input
                                  id={`meal-name-${item.key}`}
                                  value={item.name}
                                  onChange={(event) =>
                                    updateDraftItem(item.key, {
                                      name: event.target.value,
                                    })
                                  }
                                  placeholder="e.g. Chicken and rice"
                                  maxLength={150}
                                  disabled={submitting}
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`meal-description-${item.key}`}
                                  className="mb-1 block text-sm font-medium text-ink-900"
                                >
                                  Description (optional)
                                </label>

                                <textarea
                                  id={`meal-description-${item.key}`}
                                  value={item.description}
                                  onChange={(event) =>
                                    updateDraftItem(item.key, {
                                      description: event.target.value,
                                    })
                                  }
                                  placeholder="Describe what is included..."
                                  maxLength={500}
                                  rows={2}
                                  disabled={submitting}
                                  className="w-full rounded-lg border border-ink-900/20 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-900/40 focus:outline-none focus:ring-2 focus:ring-clay-500"
                                />
                              </div>
                            </div>
                          )}

                          <div className="mt-4 grid grid-cols-2 gap-4">
                            <div>
                              <label
                                htmlFor={`meal-quantity-${item.key}`}
                                className="mb-1 block text-sm font-medium text-ink-900"
                              >
                                Plates / servings
                              </label>

                              <Input
                                id={`meal-quantity-${item.key}`}
                                type="number"
                                min="1"
                                max="20"
                                step="1"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateDraftItem(item.key, {
                                    quantity: event.target.value,
                                  })
                                }
                                disabled={submitting}
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`meal-price-${item.key}`}
                                className="mb-1 block text-sm font-medium text-ink-900"
                              >
                                Price per plate ($)
                              </label>

                              <Input
                                id={`meal-price-${item.key}`}
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(event) =>
                                  updateDraftItem(item.key, {
                                    unit_price: event.target.value,
                                  })
                                }
                                placeholder="0.00"
                                disabled={submitting}
                              />
                            </div>
                          </div>

                          <div className="mt-4 flex justify-between border-t border-ink-900/10 pt-3 text-sm">
                            <span className="text-ink-900/60">
                              Item subtotal
                            </span>

                            <span className="font-semibold text-ink-900">
                              {formatMoney(subtotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-ink-900/10 pt-5">
                  <label
                    htmlFor="offer-message"
                    className="mb-2 block text-sm font-semibold text-ink-900"
                  >
                    Message to the customer (optional)
                  </label>

                  <textarea
                    id="offer-message"
                    value={message}
                    onChange={(event) => {
                      setMessage(event.target.value);
                      setSubmissionError("");
                    }}
                    placeholder="Add a short message about your offer..."
                    maxLength={1000}
                    rows={3}
                    disabled={submitting}
                    className="w-full rounded-lg border border-ink-900/20 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-900/40 focus:outline-none focus:ring-2 focus:ring-clay-500"
                  />

                  <p className="mt-1 text-right text-xs text-ink-900/40">
                    {message.length} / 1000
                  </p>
                </div>

                <div className="rounded-xl bg-cream-50 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-ink-900/60">
                        Total offer price
                      </p>

                      <p className="mt-1 text-2xl font-semibold text-ink-900">
                        {formatMoney(offerTotal)}
                      </p>
                    </div>

                    <p className="text-xs text-ink-900/50">
                      {draftItems.length} meal items
                    </p>
                  </div>
                </div>

                {submissionError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                  >
                    {submissionError}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCloseComposer}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      draftItems.length === 0 ||
                      menuLoading
                    }
                  >
                    {submitting ? "Submitting offer..." : "Submit offer"}
                  </Button>
                </div>
              </form>
            </Card>
          </section>
        )}
      </section>
    </main>
  );
}
