"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

import AccountMenu from "@/components/account-menu";
import CookNegotiations from "@/components/cook-negotiations";
import CookShell, { cookAccountLinks } from "@/components/cook-shell";
import NotificationBell from "@/components/notification-bell";
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

type SubmittedOffer = {
  id: string;
  total_price: number;
  submitted_at: string;
  items: Array<{ name: string; description: string | null; quantity: number; unit_price: number; line_total: number }>;
  request: { items: MealRequestItem[]; hub: string; pickup_date: string; pickup_time: string };
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
  paused?: boolean;
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

function formatPickupDateShort(date: string) {
  const parsedDate = new Date(`${date}T12:00:00+02:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    day: "numeric",
    month: "short",
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

function DateTile({ date }: { date: string }) {
  const parsed = new Date(`${date}T12:00:00+02:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Harare",
      ...options,
    }).format(parsed);

  return (
    <div aria-hidden="true" className="ck-date">
      <span>{format({ weekday: "short" }).toUpperCase()}</span>
      <b className="font-display">{format({ day: "numeric" })}</b>
      <span>{format({ month: "short" }).toUpperCase()}</span>
    </div>
  );
}

async function fetchCookRequests(): Promise<{
  requests: MealRequest[];
  paused: boolean;
}> {
  const response = await fetch("/api/cook/requests", {
    method: "GET",
    cache: "no-store",
  });

  const result: RequestsResponse = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Unable to load meal requests.");
  }

  return {
    requests: result.requests ?? [],
    paused: result.paused === true,
  };
}

async function fetchSubmittedOffers(): Promise<SubmittedOffer[]> {
  const response = await fetch("/api/cook/offers", { cache: "no-store" });
  const result: { offers?: SubmittedOffer[]; error?: string } = await response.json();
  if (!response.ok || !Array.isArray(result.offers)) {
    throw new Error(result.error || "Unable to load your submitted offers.");
  }
  return result.offers;
}

export default function CookPage() {
  const [requests, setRequests] = useState<MealRequest[]>([]);
  const [submittedOffers, setSubmittedOffers] = useState<SubmittedOffer[]>([]);
  const [submittedLoaded, setSubmittedLoaded] = useState(false);
  const [negotiationCount, setNegotiationCount] = useState<number | null>(null);
  const [requestsPaused, setRequestsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState("Hello");

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [menuRetry, setMenuRetry] = useState(0);
  const [stripLoading, setStripLoading] = useState(true);
  const [stripError, setStripError] = useState("");

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const composerRef = useRef<HTMLElement>(null);

  const [draftItems, setDraftItems] = useState<OfferDraftItem[]>([]);
  const [menuSelection, setMenuSelection] = useState("");
  const [message, setMessage] = useState("");
  const [isAlternative, setIsAlternative] = useState(false);

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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
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

  // Load requests when the page first mounts.
  useEffect(() => {
    let cancelled = false;

    async function loadInitialRequests() {
      try {
        const result = await fetchCookRequests();

        if (!cancelled) {
          setRequests(result.requests);
          setRequestsPaused(result.paused);
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

  useEffect(() => {
    let cancelled = false;
    void fetchSubmittedOffers().then((offers) => {
      if (!cancelled) setSubmittedOffers(offers);
    }).catch(() => {
      // Keep the incoming request feed usable if this secondary list fails.
    }).finally(() => {
      if (!cancelled) setSubmittedLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Load the saved menu for the "Your menu" card. If this fails, the offer
  // composer below still retries the menu when it is opened.
  useEffect(() => {
    let cancelled = false;

    void fetch("/api/cook/menu", { method: "GET", cache: "no-store" })
      .then(async (response) => {
        const result: MenuResponse = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Unable to load your menu.");
        }
        if (!cancelled) {
          setMenu(result.menu ?? []);
          setMenuLoaded(true);
          setMenuLoading(false);
          setStripError("");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStripError(
            err instanceof Error ? err.message : "Unable to load your menu.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setStripLoading(false);
      });

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

  // Bring the offer composer into view when a request is chosen.
  useEffect(() => {
    if (!selectedRequestId) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    composerRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [selectedRequestId]);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");

    try {
      const result = await fetchCookRequests();
      setRequests(result.requests);
      setRequestsPaused(result.paused);
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
    setDraftItems(request.items.map((item) => ({
      key: createDraftKey(),
      menu_item_id: null,
      name: item.name,
      description: "",
      quantity: String(item.quantity),
      unit_price: "",
    })));
    setMenuSelection("");
    setMessage("");
    setIsAlternative(false);
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
    setIsAlternative(false);
    setSubmissionError("");
  }

  function handleAddMenuItem(menuItemId: string) {
    const selectedMenuItem = menu.find(
      (item) => item.id === menuItemId,
    );

    if (!selectedMenuItem) {
      return;
    }

    if (draftItems.some((item) => item.menu_item_id === menuItemId)) {
      return;
    }

    const requestedQuantity = Math.max(
      1,
      ...selectedRequest?.items.map((item) => item.quantity) ?? [1],
    );

    setDraftItems(() => [
      {
        key: createDraftKey(),
        menu_item_id: selectedMenuItem.id,
        name: selectedMenuItem.name,
        description: selectedMenuItem.description ?? "",
        quantity: String(requestedQuantity),
        unit_price: String(selectedMenuItem.price),
      },
    ]);

    setSubmissionError("");
    setMenuSelection("");
  }

  function handleAddCustomMeal() {
    const requestedQuantity = Math.max(
      1,
      ...selectedRequest?.items.map((item) => item.quantity) ?? [1],
    );

    setDraftItems(() => [
      {
        key: createDraftKey(),
        menu_item_id: null,
        name: "",
        description: "",
        quantity: String(requestedQuantity),
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

    if (isAlternative && draftItems.length !== 1) {
      return "Describe one complete alternative meal for this offer.";
    }

    if (!isAlternative && draftItems.length !== selectedRequest.items.length) {
      return "Add an offer for each meal the customer requested.";
    }

    if (message.length > 1000) {
      return "Your message cannot exceed 1000 characters.";
    }

    for (const [index, item] of draftItems.entries()) {
      const quantity = Number(item.quantity);
      const price = Number(item.unit_price);

      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 20
      ) {
        return "Each meal quantity must be a whole number between 1 and 20.";
      }

      if (!isAlternative && (
        quantity !== selectedRequest.items[index]?.quantity ||
        item.name.trim().toLocaleLowerCase() !== selectedRequest.items[index]?.name.trim().toLocaleLowerCase()
      )) {
        return "Standard offers must match each requested meal and its plate count. Mark a different meal as an alternative.";
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
        if (!isAlternative && item.description.trim().length === 0) {
          return "Describe what is included in each complete plate.";
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
      is_alternative: isAlternative,
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

      void fetchSubmittedOffers().then(setSubmittedOffers).catch(() => {});

      // Remove this request because this cook has submitted an offer for it.
      setRequests((current) =>
        current.filter((request) => request.id !== selectedRequest.id),
      );

      setSelectedRequestId(null);
      setDraftItems([]);
      setMenuSelection("");
      setMessage("");
      setIsAlternative(false);
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

  const availabilityKind = loading
    ? "unknown"
    : error
      ? "unknown"
      : requestsPaused
        ? "paused"
        : "open";
  const availabilityLabel = loading
    ? "Checking availability…"
    : error
      ? "Availability unknown"
      : requestsPaused
        ? "Requests paused"
        : "Accepting requests";

  return (
    <CookShell desktopActions={false}>
      <main className="min-h-screen bg-cream-50">
        {/* Circle sized and placed like the Offerings and Profile banners. */}
        <style>{`.ck-hero-bg::after{width:340px;height:340px;right:-90px;top:-150px}`}</style>
        <div className="ck-wrap">
          {/* Hero */}
          <header className="ck-hero">
            <div className="ck-hero-bg" aria-hidden="true" />
            <div className="ck-hero-top">
              <span
                className={`ck-pill${availabilityKind === "paused" ? " is-paused" : availabilityKind === "unknown" ? " is-unknown" : ""}`}
              >
                <i aria-hidden="true" />
                {availabilityLabel}
              </span>
              <div className="ck-hero-actions">
                <NotificationBell />
                <AccountMenu links={cookAccountLinks} />
              </div>
            </div>

            <div className="ck-hero-body">
              <div>
                <p className="ck-eyebrow">Your kitchen</p>
                <h1 className="ck-h1 font-display tracking-tight text-ink-900">
                  {greeting}, <span className="text-clay-500">chef.</span>
                </h1>
                <span
                  aria-hidden="true"
                  className="mt-4 block h-1 w-14 rounded-full bg-saffron-500"
                />
                <p className="mt-3 max-w-sm text-sm leading-6 text-ink-900/75">
                  Here is what is waiting for you in the kitchen.
                </p>
              </div>

              <div className="ck-tiles" role="group" aria-label="Kitchen summary">
                <div className="ck-tile">
                  <b className="font-display">{loading || error ? "–" : requests.length}</b>
                  <span>Open requests</span>
                </div>
                <div className="ck-tile">
                  <b className="font-display">{negotiationCount ?? "–"}</b>
                  <span>Counter-offers</span>
                </div>
                <div className="ck-tile is-tint">
                  <b className="font-display">{submittedLoaded ? submittedOffers.length : "–"}</b>
                  <span>Offers waiting</span>
                </div>
              </div>
            </div>
          </header>

          <div className="ck-grid">
            <div className="ck-main">
              {success && (
                <div
                  role="status"
                  className="ck-i-banner rounded-md border border-sage-500/30 bg-sage-500/10 p-4 text-sm text-sage-500"
                >
                  {success}
                </div>
              )}

              {/* Incoming meal requests */}
              <section
                className="ck-card ck-i-requests"
                aria-labelledby="requests-heading"
              >
                <div className="ck-card-head">
                  <h2
                    id="requests-heading"
                    className="ck-title font-display text-xl font-semibold text-ink-900 sm:text-2xl"
                  >
                    Incoming meal requests
                    <span className="ck-chip">
                      {requests.length} open
                    </span>
                  </h2>
                  <button
                    type="button"
                    className="ck-outline"
                    onClick={handleRefresh}
                    disabled={loading || refreshing}
                  >
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {loading && (
                  <p role="status" className="mt-5 text-sm text-ink-900/60">
                    Loading meal requests...
                  </p>
                )}

                {!loading && error && (
                  <div className="mt-5 space-y-3 rounded-md border border-red-700/20 p-4">
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
                )}

                {!loading && !error && requests.length === 0 && (
                  <div className="mx-auto mt-6 max-w-md py-6 text-center">
                    <h3 className="font-display text-xl font-semibold text-ink-900">
                      {requestsPaused ? "Your profile is paused" : "No open requests yet"}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-ink-900/60">
                      {requestsPaused
                        ? "Resume availability in your profile to see new meal requests."
                        : "New customer meal requests will appear here when they become available. Check back shortly."}
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
                )}

                {!loading && !error && requests.length > 0 && (
                  <ul className="ck-req-list">
                    {requests.map((request) => {
                      const plates = request.items.reduce(
                        (sum, item) => sum + item.quantity,
                        0,
                      );
                      const deadline = request.offers_close_at
                        ? formatDeadline(request.offers_close_at)
                        : null;

                      return (
                        <li key={request.id} className="ck-req">
                          <DateTile date={request.pickup_date} />

                          <div className="ck-req-main">
                            <h3
                              className="font-display text-lg font-semibold leading-snug text-ink-900"
                              style={{ overflowWrap: "anywhere" }}
                            >
                              <span className="sr-only">Requested meals: </span>
                              {request.items
                                .map((item) => `${item.quantity} × ${item.name}`)
                                .join(", ")}
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-ink-900/65">
                              {request.hub} · {formatPickupDateShort(request.pickup_date)}{" "}
                              {formatPickupTime(request.pickup_time)}
                              {deadline ? ` · offer by ${deadline}` : ""}
                            </p>
                            {request.notes && (
                              <p className="mt-2 rounded-md bg-cream-50 p-2.5 text-sm leading-5 text-ink-900/80" style={{ overflowWrap: "anywhere" }}>
                                <span className="font-semibold text-ink-900/60">Customer notes: </span>
                                {request.notes}
                              </p>
                            )}
                          </div>

                          <div className="ck-req-side">
                            <div>
                              <p className="text-sm font-semibold text-ink-900">
                                {plates} {plates === 1 ? "plate" : "plates"}
                              </p>
                              <p className="text-xs text-ink-900/65">
                                {request.budget !== null
                                  ? `Target ${formatMoney(Number(request.budget))} / plate`
                                  : "No target set"}
                              </p>
                              <p className="text-[11px] text-ink-900/50">
                                Customer guide, not a price cap
                              </p>
                            </div>
                            <button
                              type="button"
                              className="ck-solid"
                              onClick={() => handlePrepareOffer(request)}
                              disabled={submitting}
                            >
                              {selectedRequestId === request.id
                                ? "Offer selected"
                                : "Prepare offer →"}
                            </button>
                          </div>

                          <details>
                            <summary>View request details</summary>
                            <div className="mt-2 space-y-3 text-sm">
                              <ul className="divide-y divide-ink-900/10 border-y border-ink-900/10">
                                {request.items.map((item, index) => (
                                  <li
                                    key={`${request.id}-${index}`}
                                    className="flex min-w-0 items-start justify-between gap-3 py-2"
                                  >
                                    <span className="min-w-0 break-words text-ink-900/80">
                                      {item.name}
                                    </span>
                                    <span className="shrink-0 font-medium text-ink-900">
                                      × {item.quantity}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              <p className="text-xs text-ink-900/60">
                                Pickup {formatPickupDate(request.pickup_date)} at{" "}
                                {formatPickupTime(request.pickup_time)}
                              </p>
                              <div className="space-y-1 break-all text-xs text-ink-900/55">
                                <p>Request ID: {request.id}</p>
                                <p>
                                  Submitted:{" "}
                                  {new Date(request.created_at).toLocaleString("en-ZW")}
                                </p>
                              </div>
                            </div>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {!loading && !error && requests.length > 0 && (
                  <p className="mt-2 text-xs leading-5 text-ink-900/55">
                    Prepare offer opens your offer composer below, with standard
                    and alternative offers.
                  </p>
                )}
              </section>

              {selectedRequest && (
                <section
                  ref={composerRef}
                  className="ck-i-composer"
                  aria-labelledby="offer-heading"
                >
                  <div className="mb-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay-500">
                      Offer preparation
                    </p>
                    <h2
                      id="offer-heading"
                      className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl"
                    >
                      Prepare your offer
                    </h2>
                    <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-ink-900/65">
                      For the {selectedRequest.hub} request, with pickup on{" "}
                      {formatPickupDate(selectedRequest.pickup_date)} at{" "}
                      {formatPickupTime(selectedRequest.pickup_time)}.
                    </p>
                  </div>

                  <Card className="border border-ink-900/10 bg-white shadow-none">
                    <form
                      onSubmit={handleSubmitOffer}
                      className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,0.8fr)] lg:gap-8"
                    >
                      <div className="min-w-0 space-y-7">
                        <div className="rounded-md border border-sage-500/20 bg-sage-500/5 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-sage-700">
                            Customer requested
                          </p>
                          <ul className="mt-2 space-y-1 text-sm text-ink-900">
                            {selectedRequest.items.map((item, index) => (
                              <li key={`${selectedRequest.id}-offer-${index}`}>
                                {item.quantity} plates · {item.name}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-xs text-ink-900/60">
                            Your standard offer must cover the requested plate count.
                          </p>
                        </div>

                        <section aria-labelledby="offer-meals-heading">
                          <div className="mb-4">
                            <h3
                              id="offer-meals-heading"
                              className="font-semibold text-ink-900"
                            >
                              Build one complete meal offer
                            </h3>
                            <p className="mt-1 text-sm leading-6 text-ink-900/60">
                              Choose one saved meal or describe a complete meal. Set
                              one price per plate so customers can compare offers fairly.
                            </p>
                          </div>

                          {menuLoading && (
                            <p role="status" className="mt-4 text-sm text-ink-900/60">
                              Loading your menu...
                            </p>
                          )}

                          {menuError && (
                            <div className="mt-4 rounded-md border border-red-700/20 bg-red-50 p-3">
                              <p className="break-words text-sm text-red-700">
                                {menuError}
                              </p>
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
                              {isAlternative && menu.length > 0 ? (
                                <div>
                                  <label
                                    htmlFor="offer-menu-item"
                                    className="mb-1 block text-sm font-medium text-ink-900"
                                  >
                                    Saved menu
                                  </label>
                                  <select
                                    id="offer-menu-item"
                                    value={menuSelection}
                                    onChange={(event) => {
                                      const id = event.target.value;
                                      if (id) {
                                        handleAddMenuItem(id);
                                      }
                                    }}
                                    className="min-h-11 w-full min-w-0 rounded-md border border-ink-900/20 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-clay-500"
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
                                          {item.name} —{" "}
                                          {formatMoney(Number(item.price))}
                                          {alreadyAdded ? " (Added)" : ""}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              ) : isAlternative ? (
                                <p className="text-sm leading-6 text-ink-900/60">
                                  You have no available saved menu items. You can
                                  still create an offer using custom meals.
                                </p>
                              ) : null}
                            </div>
                          )}

                          {isAlternative && <div className="mt-4 border-t border-ink-900/10 pt-4">
                            <h4 className="text-sm font-medium text-ink-900">
                              Custom meal
                            </h4>
                            <p className="mt-1 text-sm leading-6 text-ink-900/60">
                              Add a meal that is not in your saved menu.
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              className="mt-3 min-h-11 rounded-md"
                              onClick={handleAddCustomMeal}
                              disabled={draftItems.length >= 20 || submitting}
                            >
                                {draftItems.length ? "Replace with custom meal" : "Describe a custom meal"}
                            </Button>
                          </div>}
                        </section>

                        <section
                          className="border-t border-ink-900/10 pt-6"
                          aria-labelledby="draft-items-heading"
                        >
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                            <h3
                              id="draft-items-heading"
                              className="font-semibold text-ink-900"
                            >
                              Your meal offer
                            </h3>
                            <span className="text-xs text-ink-900/55">
                              {isAlternative ? `${draftItems.length} alternative meal` : `${draftItems.length} / ${selectedRequest.items.length} requested meals`}
                            </span>
                          </div>

                          {draftItems.length === 0 && (
                            <div className="rounded-md bg-cream-50 p-5">
                              <p className="text-sm leading-6 text-ink-900/60">
                                {isAlternative ? "Add one alternative meal to continue." : "Every requested meal is listed below. Add its plate details and price."}
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
                                  className="min-w-0 rounded-md border border-ink-900/10 p-4 sm:p-5"
                                >
                                  <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-clay-500">
                                        Offer item {index + 1}
                                      </p>
                                      <p className="mt-1 text-sm text-ink-900/55">
                                        {isAlternative && item.menu_item_id
                                          ? "Saved menu item"
                                          : isAlternative ? "Alternative meal" : `${selectedRequest.items[index]?.quantity ?? item.quantity} requested plates`}
                                      </p>
                                    </div>
                                    {isAlternative && <button
                                      type="button"
                                      onClick={() => removeDraftItem(item.key)}
                                      disabled={submitting}
                                      className="min-h-10 shrink-0 rounded-md px-2 text-sm font-medium text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 disabled:opacity-50"
                                    >
                                      Remove
                                    </button>}
                                  </div>

                                  {isAlternative && item.menu_item_id ? (
                                    <div className="min-w-0">
                                      <p className="break-words font-medium text-ink-900">
                                        {item.name}
                                      </p>
                                      {item.description && (
                                        <p className="mt-1 break-words text-sm leading-6 text-ink-900/60">
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
                                          readOnly={!isAlternative}
                                        />
                                      </div>
                                      <div>
                                        <label
                                          htmlFor={`meal-description-${item.key}`}
                                          className="mb-1 block text-sm font-medium text-ink-900"
                                        >
                                          {isAlternative ? "Description (optional)" : "What is included in this meal?"}
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
                                          className="w-full min-w-0 rounded-md border border-ink-900/20 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-900/40 focus:outline-none focus:ring-2 focus:ring-clay-500"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                                    {isAlternative && <div className="min-w-0">
                                      <label
                                        htmlFor={`meal-quantity-${item.key}`}
                                        className="mb-1 block text-sm font-medium text-ink-900"
                                      >
                                        Plates in this offer
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
                                    </div>}
                                    {!isAlternative && <p className="text-sm text-ink-900/70">Quantity: {selectedRequest.items[index]?.quantity} plates</p>}
                                    <div className="min-w-0">
                                      <label
                                        htmlFor={`meal-price-${item.key}`}
                                        className="mb-1 block text-sm font-medium text-ink-900"
                                      >
                                        Price per plate (USD)
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

                                  <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-ink-900/10 pt-3 text-sm">
                                    <span className="text-ink-900/60">
                                      Total for {quantity || "these"} plates
                                    </span>
                                    <span className="font-semibold text-ink-900">
                                      {formatMoney(subtotal)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      </div>

                      <aside className="min-w-0 space-y-5 border-t border-ink-900/10 pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
                        <div>
                          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-saffron-500/30 bg-saffron-500/5 p-3">
                            <input
                              type="checkbox"
                              checked={isAlternative}
                              onChange={(event) => {
                                const nextAlternative = event.target.checked;
                                setIsAlternative(nextAlternative);
                                if (nextAlternative) setDraftItems([]);
                                else setDraftItems(selectedRequest.items.map((item) => ({ key: createDraftKey(), menu_item_id: null, name: item.name, description: "", quantity: String(item.quantity), unit_price: "" })));
                              }}
                              disabled={submitting}
                              className="mt-1 size-5 shrink-0 accent-clay-500"
                            />
                            <span>
                              <span className="block text-sm font-semibold text-ink-900">
                                This is an alternative offer
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-ink-900/65">
                                Choose this if the meal or plate quantity differs from the customer&apos;s request. The customer will see it clearly labeled.
                              </span>
                            </span>
                          </label>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay-500">
                            Customer message
                          </p>
                          <label
                            htmlFor="offer-message"
                            className="mt-2 block text-sm font-semibold text-ink-900"
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
                            rows={4}
                            disabled={submitting}
                            className="mt-2 w-full min-w-0 rounded-md border border-ink-900/20 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-900/40 focus:outline-none focus:ring-2 focus:ring-clay-500"
                          />
                          <p className="mt-1 text-right text-xs text-ink-900/45">
                            {message.length} / 1000
                          </p>
                        </div>

                        <div className="border-y border-ink-900/10 py-5">
                          <p className="text-sm font-medium text-ink-900/65">{isAlternative ? "Price per plate" : "Total offer price"}</p>
                          {isAlternative && <p className="mt-1 font-display text-3xl font-semibold text-ink-900">{formatMoney(Number(draftItems[0]?.unit_price) || 0)}</p>}
                          <p className="mt-4 text-sm font-medium text-ink-900/65">{isAlternative ? `Total for ${draftItems[0]?.quantity || 0} plates` : `For ${selectedRequest.items.reduce((sum, item) => sum + item.quantity, 0)} requested plates`}</p>
                          <p className="mt-1 break-words font-display text-3xl font-semibold text-ink-900">
                            {formatMoney(offerTotal)}
                          </p>
                          <p className="mt-2 text-xs text-ink-900/55">
                            {draftItems.length ? (isAlternative ? "Alternative offer" : "All requested meals included") : "Add meal details to continue"}
                          </p>
                        </div>

                        {submissionError && (
                          <p
                            role="alert"
                            className="break-words rounded-md bg-red-50 p-3 text-sm text-red-700"
                          >
                            {submissionError}
                          </p>
                        )}

                        <div className="flex flex-col-reverse gap-3 sm:flex-row lg:flex-col-reverse">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleCloseComposer}
                            disabled={submitting}
                            className="min-h-11 w-full rounded-md"
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
                            className="min-h-11 w-full rounded-md font-semibold"
                          >
                            {submitting ? "Submitting offer..." : "Submit offer"}
                          </Button>
                        </div>
                      </aside>
                    </form>
                  </Card>
                </section>
              )}

              {/* Your menu */}
              <section className="ck-card ck-i-menu" aria-labelledby="menu-heading">
                <div className="ck-card-head">
                  <div>
                    <h2
                      id="menu-heading"
                      className="font-display text-xl font-semibold text-ink-900 sm:text-2xl"
                    >
                      Your menu
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-900/65">
                      Your saved meals and your own prices.
                    </p>
                  </div>
                  <Link href="/cook/menu" className="ck-outline">
                    Manage menu →
                  </Link>
                </div>

                {stripLoading && (
                  <p role="status" className="mt-4 text-sm text-ink-900/60">
                    Loading your menu...
                  </p>
                )}

                {!stripLoading && stripError && (
                  <p role="alert" className="mt-4 text-sm text-red-700">
                    {stripError}
                  </p>
                )}

                {!stripLoading && !stripError && menu.length === 0 && (
                  <p className="mt-4 text-sm leading-6 text-ink-900/65">
                    You have no saved meals yet. Add some in Manage menu to
                    speed up your offers.
                  </p>
                )}

                {!stripLoading && !stripError && menu.length > 0 && (
                  <>
                    <ul className="ck-menu-grid">
                      {menu.slice(0, 4).map((item) => (
                        <li key={item.id}>
                          <div className="ck-menu-tile">
                            <p
                              className="font-display text-base leading-snug text-ink-900"
                              style={{ overflowWrap: "anywhere" }}
                            >
                              {item.name}
                            </p>
                            <p className="text-sm font-semibold text-clay-500">
                              {formatMoney(Number(item.price))}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {menu.length > 4 && (
                      <p className="mt-3 text-xs text-ink-900/60">
                        + {menu.length - 4} more in Manage menu
                      </p>
                    )}
                  </>
                )}
              </section>
            </div>

            <div className="ck-side">
              {/* Kitchen status */}
              <section className="ck-card ck-i-status" aria-labelledby="status-heading">
                <h2
                  id="status-heading"
                  className="font-display text-xl font-semibold text-ink-900"
                >
                  Kitchen status
                </h2>
                <div className={`ck-status${availabilityKind === "paused" ? " is-paused" : ""}`}>
                  <i aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {availabilityLabel}
                    </p>
                    <p className="text-xs leading-5 text-ink-900/70">
                      {availabilityKind === "paused"
                        ? "Your cook profile is paused. New meal requests are hidden and new offers are disabled."
                        : availabilityKind === "open"
                          ? "Customers can receive your offers."
                          : "We could not confirm your availability."}
                    </p>
                  </div>
                </div>
                <Link
                  href="/cook/profile"
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-clay-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                >
                  Change in your profile →
                </Link>
              </section>

              <CookNegotiations
                className="ck-i-counter"
                onCountChange={setNegotiationCount}
              />

              {/* Offers waiting on customers */}
              {submittedOffers.length > 0 && (
                <section
                  className="ck-card ck-i-offers"
                  aria-labelledby="submitted-offers-heading"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2
                      id="submitted-offers-heading"
                      className="font-display text-xl font-semibold text-ink-900"
                    >
                      Offers waiting on customers
                    </h2>
                    <span className="text-xs text-ink-900/60">
                      {submittedOffers.length} awaiting a choice
                    </span>
                  </div>
                  <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                    {submittedOffers.map((offer) => {
                      const plates = offer.request.items.reduce(
                        (sum, item) => sum + item.quantity,
                        0,
                      );
                      return (
                        <li key={offer.id} className="ck-offer-row">
                          <div className="min-w-0" style={{ flex: "1 1 160px" }}>
                            <h3
                              className="text-sm font-semibold text-ink-900"
                              style={{ overflowWrap: "anywhere" }}
                            >
                              {offer.items[0]?.name || "Your meal offer"}
                              {plates ? `, ${plates} ${plates === 1 ? "plate" : "plates"}` : ""}
                            </h3>
                            <p className="mt-0.5 text-xs leading-5 text-ink-900/65">
                              For {offer.request.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}
                            </p>
                            <p className="mt-0.5 text-xs leading-5 text-ink-900/60">
                              {offer.request.hub} · {formatPickupDate(offer.request.pickup_date)} ·{" "}
                              {formatPickupTime(offer.request.pickup_time)}
                            </p>
                            {offer.items[0]?.description && (
                              <p className="mt-1.5 text-xs leading-5 text-ink-900/70">
                                {offer.items[0].description}
                              </p>
                            )}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p className="text-sm font-semibold text-ink-900">
                              {formatMoney(Number(offer.items[0]?.unit_price) || 0)} / plate
                            </p>
                            <p className="text-xs text-ink-900/60">
                              {formatMoney(Number(offer.total_price))} total
                            </p>
                            <span className="mt-1.5 inline-flex rounded-full bg-saffron-500/15 px-2.5 py-1 text-[11px] font-semibold text-ink-900">
                              Customer deciding
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>
    </CookShell>
  );
}