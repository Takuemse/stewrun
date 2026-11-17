"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";

type OrderRating = { stars: number; comment: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRating(value: unknown): value is OrderRating {
  return (
    isRecord(value) &&
    Number.isInteger(value.stars) &&
    Number(value.stars) >= 1 &&
    Number(value.stars) <= 5 &&
    (value.comment === null || typeof value.comment === "string")
  );
}

export default function OrderRating({ orderId }: { orderId: string }) {
  const [rating, setRating] = useState<OrderRating | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissTimeout = window.setTimeout(() => {
      try {
        setDismissed(window.localStorage.getItem(`stewrun:rating-later:${orderId}`) === "true");
      } catch {
        // Keep the prompt available when browser storage is disabled.
      }
    }, 0);

    let active = true;
    void fetch(`/api/orders/${encodeURIComponent(orderId)}/rating`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok || !isRecord(payload)) {
          throw new Error("Unable to load your rating.");
        }
        if (payload.rating !== null && !isRating(payload.rating)) {
          throw new Error("The rating response was invalid.");
        }
        if (active) setRating(payload.rating as OrderRating | null);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load your rating.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(dismissTimeout);
    };
  }, [orderId]);

  function chooseLater() {
    setDismissed(true);
    try {
      window.localStorage.setItem(`stewrun:rating-later:${orderId}`, "true");
    } catch {
      // Dismiss for this view even when browser storage is disabled.
    }
  }

  async function submitRating() {
    if (saving || stars < 1) return;
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/rating`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ stars, comment }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isRecord(payload) || !isRating(payload.rating)) {
        throw new Error(
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Unable to save your rating.",
        );
      }
      setRating(payload.rating);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save your rating.");
    } finally {
      setSaving(false);
    }
  }

  if (dismissed) return null;
  if (loading) return <p className="text-xs text-ink-900/55" role="status">Loading rating...</p>;

  return (
    <section className="rounded-md border border-ink-900/10 bg-cream-50 p-4" aria-label="Rate your meal">
      {rating ? (
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Star aria-hidden="true" className="size-4 fill-saffron-500 text-saffron-500" />
            You rated this meal {rating.stars} out of 5
          </p>
          {rating.comment && <p className="mt-2 text-sm leading-5 text-ink-900/70">{rating.comment}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-ink-900">How was your meal?</p>
            <p className="mt-1 text-xs text-ink-900/60">Your rating helps customers choose local cooks.</p>
          </div>
          <fieldset>
            <legend className="sr-only">Choose a star rating</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                  aria-pressed={stars === value}
                  onClick={() => setStars(value)}
                  className="flex size-10 items-center justify-center rounded-md hover:bg-white focus-visible:outline-2 focus-visible:outline-clay-500"
                >
                  <Star className={`size-5 ${stars >= value ? "fill-saffron-500 text-saffron-500" : "text-ink-900/35"}`} />
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block space-y-1 text-xs font-medium text-ink-900/70">
            Comment (optional)
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-md border border-ink-900/20 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-2 focus-visible:outline-clay-500"
            />
          </label>
          {error && <p role="alert" className="text-sm text-clay-500">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={saving || stars === 0} onClick={() => void submitRating()} className="min-h-10 w-full sm:w-auto">
              {saving ? "Saving rating..." : "Submit rating"}
            </Button>
            <button type="button" onClick={chooseLater} disabled={saving} className="min-h-10 rounded-md px-3 text-sm font-medium text-ink-900/65 underline underline-offset-4 hover:text-ink-900">Maybe later</button>
          </div>
        </div>
      )}
      {error && rating && <p role="alert" className="mt-2 text-sm text-clay-500">{error}</p>}
    </section>
  );
}
