"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock3, MapPin, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RequestDetails = {
  id: string;
  items: { name: string; quantity: number }[];
  hub: string;
  pickup_date: string;
  pickup_time: string;
  notes: string | null;
};

type Counteroffer = {
  id: string;
  proposed_total: number | string;
  message: string | null;
  created_at: string;
  request: RequestDetails | null;
  offer: { id: string; total_price: number | string } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isCounteroffer(value: unknown): value is Counteroffer {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    (typeof value.proposed_total !== "number" &&
      typeof value.proposed_total !== "string") ||
    (value.message !== null && typeof value.message !== "string") ||
    typeof value.created_at !== "string"
  ) {
    return false;
  }

  if (value.request !== null) {
    if (
      !isRecord(value.request) ||
      typeof value.request.id !== "string" ||
      !Array.isArray(value.request.items) ||
      !value.request.items.every(
        (item) =>
          isRecord(item) &&
          typeof item.name === "string" &&
          typeof item.quantity === "number",
      ) ||
      typeof value.request.hub !== "string" ||
      typeof value.request.pickup_date !== "string" ||
      typeof value.request.pickup_time !== "string" ||
      (value.request.notes !== null &&
        typeof value.request.notes !== "string")
    ) {
      return false;
    }
  }

  return (
    value.offer === null ||
    (isRecord(value.offer) &&
      typeof value.offer.id === "string" &&
      (typeof value.offer.total_price === "number" ||
        typeof value.offer.total_price === "string"))
  );
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00+02:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-ZW", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Harare",
      }).format(date);
}

function getErrorMessage(value: unknown) {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : "Unable to update counter-offer.";
}

async function fetchNegotiations(): Promise<Counteroffer[]> {
  const response = await fetch("/api/cook/negotiations", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json();

  if (!response.ok) throw new Error(getErrorMessage(payload));
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.negotiations) ||
    !payload.negotiations.every(isCounteroffer)
  ) {
    throw new Error("The counter-offer response was invalid.");
  }

  return payload.negotiations;
}

export default function CookNegotiations() {
  const [negotiations, setNegotiations] = useState<Counteroffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadNegotiations = useCallback(async () => {
    setRefreshing(true);

    try {
      setNegotiations(await fetchNegotiations());
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load counter-offers.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void fetchNegotiations()
      .then((loadedNegotiations) => {
        if (active) setNegotiations(loadedNegotiations);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load counter-offers.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function respond(
    negotiation: Counteroffer,
    decision: "accepted" | "rejected",
  ) {
    const reason = reasonById[negotiation.id]?.trim() ?? "";

    if (savingId) return;
    if (decision === "rejected" && (reason.length < 3 || reason.length > 500)) {
      setError("Enter a rejection reason between 3 and 500 characters.");
      return;
    }

    setSavingId(negotiation.id);
    setError("");

    try {
      const response = await fetch("/api/negotiations/respond", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          negotiation_id: negotiation.id,
          decision,
          response_message: decision === "rejected" ? reason : null,
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) throw new Error(getErrorMessage(payload));
      await loadNegotiations();
    } catch (responseError) {
      setError(
        responseError instanceof Error
          ? responseError.message
          : "Unable to update the counter-offer.",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section aria-labelledby="counteroffers-heading" className="mb-9">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay-500">
            Offer follow-up
          </p>
          <h2
            id="counteroffers-heading"
            className="mt-1 font-display text-2xl font-semibold text-ink-900"
          >
            Customer counter-offers
          </h2>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void loadNegotiations()}
          disabled={refreshing || savingId !== null}
          className="min-h-10 rounded-md"
        >
          <RefreshCw aria-hidden="true" className="mr-2 size-4" />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-700/20 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadNegotiations()}
            className="mt-2 inline-flex min-h-8 items-center gap-1 font-semibold"
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
            Retry
          </button>
        </div>
      )}

      {loading && (
        <Card className="border border-ink-900/10 shadow-none">
          <p className="flex items-center gap-2 text-sm text-ink-900/60" role="status">
            <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
            Loading customer counter-offers...
          </p>
        </Card>
      )}

      {!loading && negotiations.length === 0 && !error && (
        <Card className="border border-dashed border-ink-900/15 bg-white text-sm text-ink-900/65 shadow-none">
          No pending counter-offers. Customer replies to your offers will
          appear here.
        </Card>
      )}

      {!loading && negotiations.length > 0 && (
        <ul className="grid gap-3">
          {negotiations.map((negotiation) => {
            const request = negotiation.request;

            return (
              <li key={negotiation.id}>
                <Card className="border border-ink-900/10 p-4 shadow-none sm:p-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-900/50">
                        Customer counter-offer
                      </p>
                      <h3 className="mt-1 break-words font-semibold text-ink-900">
                        {request?.items
                          .map((item) => `${item.quantity} × ${item.name}`)
                          .join(", ") || "Meal request details unavailable"}
                      </h3>
                    </div>
                    <span className="w-fit rounded-md bg-saffron-500/10 px-3 py-1.5 text-sm font-semibold text-ink-900">
                      Proposed {formatCurrency(negotiation.proposed_total)}
                    </span>
                  </div>

                  {negotiation.offer && (
                    <p className="mt-3 text-sm text-ink-900/70">
                      Your submitted offer:{" "}
                      <span className="font-semibold text-ink-900">
                        {formatCurrency(negotiation.offer.total_price)}
                      </span>
                    </p>
                  )}

                  {negotiation.message && (
                    <p className="mt-3 whitespace-pre-wrap rounded-md bg-cream-50 p-3 text-sm leading-5 text-ink-900/70">
                      {negotiation.message}
                    </p>
                  )}

                  {request && (
                    <dl className="mt-4 grid grid-cols-1 gap-3 border-y border-ink-900/10 py-3 min-[400px]:grid-cols-3">
                      <div className="flex items-start gap-2">
                        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-clay-500" />
                        <div>
                          <dt className="text-xs text-ink-900/55">Pickup hub</dt>
                          <dd className="text-sm font-medium text-ink-900">{request.hub}</dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-clay-500" />
                        <div>
                          <dt className="text-xs text-ink-900/55">Pickup date</dt>
                          <dd className="text-sm font-medium text-ink-900">{formatDate(request.pickup_date)}</dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-clay-500" />
                        <div>
                          <dt className="text-xs text-ink-900/55">Pickup time</dt>
                          <dd className="text-sm font-medium text-ink-900">{request.pickup_time.slice(0, 5)}</dd>
                        </div>
                      </div>
                    </dl>
                  )}

                  {request?.notes && (
                    <p className="mt-3 text-sm leading-5 text-ink-900/65">
                      Customer notes: {request.notes}
                    </p>
                  )}

                  <label className="mt-4 block space-y-1.5 text-sm font-medium text-ink-900">
                    Reason, if declining
                    <textarea
                      value={reasonById[negotiation.id] ?? ""}
                      onChange={(event) =>
                        setReasonById((current) => ({
                          ...current,
                          [negotiation.id]: event.target.value,
                        }))
                      }
                      maxLength={500}
                      rows={2}
                      disabled={savingId !== null}
                      className="w-full rounded-md border border-ink-900/20 bg-white px-3 py-2 text-sm font-normal text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                    />
                    <span className="block text-xs font-normal text-ink-900/55">
                      A reason of at least 3 characters is required to decline.
                    </span>
                  </label>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={savingId !== null}
                      onClick={() => void respond(negotiation, "rejected")}
                      className="min-h-11 rounded-md"
                    >
                      {savingId === negotiation.id ? "Updating..." : "Decline with reason"}
                    </Button>
                    <Button
                      type="button"
                      disabled={savingId !== null}
                      onClick={() => void respond(negotiation, "accepted")}
                      className="min-h-11 rounded-md"
                    >
                      {savingId === negotiation.id ? "Updating..." : "Accept counter-offer"}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
