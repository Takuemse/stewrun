"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock3, MapPin, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

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

export default function CookNegotiations({
  className = "",
  onCountChange,
}: {
  className?: string;
  /** Reports how many counter-offers are waiting (null while loading). */
  onCountChange?: (count: number | null) => void;
}) {
  const [negotiations, setNegotiations] = useState<Counteroffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

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

  useEffect(() => {
    onCountChange?.(loading ? null : negotiations.length);
  }, [loading, negotiations.length, onCountChange]);

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
      setDecliningId(null);
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

  const hasItems = !loading && negotiations.length > 0;

  return (
    <section
      aria-labelledby="counteroffers-heading"
      className={`${className}${hasItems ? " ck-urgent" : ""}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="ck-eyebrow" style={{ color: "#B4472B" }}>
            {hasItems ? "Needs your decision" : "Offer follow-up"}
          </p>
          <h2
            id="counteroffers-heading"
            className="mt-0.5 font-display text-xl font-semibold text-ink-900"
          >
            Customer counter-offers
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void loadNegotiations()}
          disabled={refreshing || savingId !== null}
          className="ck-outline"
        >
          <RefreshCw aria-hidden="true" className="mr-1.5 size-3.5" />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-700/20 bg-red-50 p-4 text-sm text-red-800" role="alert">
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
        <div className="ck-card">
          <p className="flex items-center gap-2 text-sm text-ink-900/60" role="status">
            <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
            Loading customer counter-offers...
          </p>
        </div>
      )}

      {!loading && negotiations.length === 0 && !error && (
        <div className="ck-card text-sm leading-6 text-ink-900/65" style={{ border: "1px dashed rgba(42,33,28,.15)", boxShadow: "none" }}>
          No pending counter-offers. Customer replies to your offers will
          appear here.
        </div>
      )}

      {hasItems && (
        <ul className="grid gap-3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {negotiations.map((negotiation) => {
            const request = negotiation.request;
            const plates = request?.items.reduce((sum, item) => sum + item.quantity, 0);
            const declining = decliningId === negotiation.id;

            return (
              <li key={negotiation.id}>
                <div className="ck-urgent-card">
                  <h3 className="font-display text-xl font-semibold text-ink-900">
                    Customer counter-offer
                  </h3>
                  <p
                    className="mt-1 text-sm font-semibold text-ink-900"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {request?.items
                      .map((item) => `${item.quantity} × ${item.name}`)
                      .join(", ") || "Meal request details unavailable"}
                  </p>
                  {request && (
                    <p className="mt-1 text-xs leading-5 text-ink-900/65">
                      {request.hub} · {formatDate(request.pickup_date)} ·{" "}
                      {request.pickup_time.slice(0, 5)}
                      {plates ? ` · ${plates} ${plates === 1 ? "plate" : "plates"}` : ""}
                    </p>
                  )}

                  <div className="ck-pair">
                    <div>
                      <small>Your offer</small>
                      <b className="font-display">
                        {negotiation.offer
                          ? formatCurrency(negotiation.offer.total_price)
                          : "–"}
                      </b>
                    </div>
                    <div>
                      <small>Customer proposes</small>
                      <b className="font-display">
                        {formatCurrency(negotiation.proposed_total)}
                      </b>
                    </div>
                  </div>

                  {negotiation.message && (
                    <p className="mt-3 whitespace-pre-wrap rounded-md bg-cream-50 p-3 text-sm leading-5 text-ink-900/70">
                      {negotiation.message}
                    </p>
                  )}

                  {request && (
                    <dl className="mt-3 grid grid-cols-1 gap-2 border-y border-ink-900/10 py-3 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-clay-500" />
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-ink-900/55">Pickup hub</dt>
                          <dd className="font-medium text-ink-900">{request.hub}</dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-clay-500" />
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-ink-900/55">Pickup date</dt>
                          <dd className="font-medium text-ink-900">{formatDate(request.pickup_date)}</dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-clay-500" />
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-ink-900/55">Pickup time</dt>
                          <dd className="font-medium text-ink-900">{request.pickup_time.slice(0, 5)}</dd>
                        </div>
                      </div>
                    </dl>
                  )}

                  {request?.notes && (
                    <p className="mt-3 text-sm leading-5 text-ink-900/65">
                      Customer notes: {request.notes}
                    </p>
                  )}

                  {declining && (
                    <label className="mt-4 block space-y-1.5 text-sm font-medium text-ink-900">
                      Reason for declining
                      <textarea
                        value={reasonById[negotiation.id] ?? ""}
                        onChange={(event) =>
                          setReasonById((current) => ({
                            ...current,
                            [negotiation.id]: event.target.value,
                          }))
                        }
                        maxLength={500}
                        rows={3}
                        disabled={savingId !== null}
                        className="w-full rounded-md border border-ink-900/20 bg-white px-3 py-2 text-base font-normal text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                      />
                      <span className="block text-xs font-normal text-ink-900/55">
                        A reason of at least 3 characters is required to decline.
                      </span>
                    </label>
                  )}

                  {declining ? (
                    <div className="ck-actions">
                      <button
                        type="button"
                        className="ck-outline"
                        disabled={savingId !== null}
                        onClick={() => setDecliningId(null)}
                      >
                        Back
                      </button>
                      <Button
                        type="button"
                        disabled={savingId !== null}
                        onClick={() => void respond(negotiation, "rejected")}
                        className="min-h-11"
                        style={{ borderRadius: 999 }}
                      >
                        {savingId === negotiation.id ? "Updating..." : "Decline with reason"}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="ck-actions">
                        <Button
                          type="button"
                          disabled={savingId !== null}
                          onClick={() => void respond(negotiation, "accepted")}
                          aria-label="Accept counter-offer"
                          className="min-h-11"
                          style={{ borderRadius: 999 }}
                        >
                          {savingId === negotiation.id ? "Updating..." : "Accept"}
                        </Button>
                        <button
                          type="button"
                          className="ck-outline"
                          disabled={savingId !== null}
                          onClick={() => setDecliningId(negotiation.id)}
                          aria-label="Decline counter-offer"
                        >
                          Decline
                        </button>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-ink-900/55">
                        Declining asks for a reason, 3 to 500 characters.
                      </p>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}