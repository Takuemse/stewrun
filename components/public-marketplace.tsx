"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, RefreshCw, Star, Utensils } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SUPPORTED_PICKUP_HUBS } from "@/lib/validate-supported-hubs";

type Offering = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  cook: {
    display_name: string;
    bio: string | null;
    supported_hubs: string[];
    rating: { average_stars: number; rating_count: number } | null;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isOffering(value: unknown): value is Offering {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.description === null || typeof value.description === "string") &&
    (typeof value.price === "number" || typeof value.price === "string") &&
    isRecord(value.cook) &&
    typeof value.cook.display_name === "string" &&
    (value.cook.bio === null || typeof value.cook.bio === "string") &&
    Array.isArray(value.cook.supported_hubs) &&
    value.cook.supported_hubs.every((hub) =>
      SUPPORTED_PICKUP_HUBS.includes(hub as (typeof SUPPORTED_PICKUP_HUBS)[number]),
    ) &&
    (value.cook.rating === null ||
      (isRecord(value.cook.rating) &&
        typeof value.cook.rating.average_stars === "number" &&
        typeof value.cook.rating.rating_count === "number"))
  );
}

async function fetchOfferings(): Promise<Offering[]> {
  const response = await fetch("/api/menu", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error(
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : "Unable to load food offerings.",
    );
  }

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.menu) ||
    !payload.menu.every(isOffering)
  ) {
    throw new Error("The food offerings response was invalid.");
  }

  return payload.menu;
}

export default function PublicMarketplace() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOfferings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setOfferings(await fetchOfferings());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load food offerings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void fetchOfferings()
      .then((loadedOfferings) => {
        if (active) setOfferings(loadedOfferings);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load food offerings.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      id="marketplace"
      aria-labelledby="marketplace-heading"
      className="border-y border-ink-900/10 bg-white"
    >
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
              Browse real local offerings
            </p>
            <h2
              id="marketplace-heading"
              className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl"
            >
              See what Harare cooks are making.
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-900/70">
              These published meals are a starting point for discovery. You
              can still describe a different meal and propose your own budget.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 w-fit items-center justify-center rounded-md border border-ink-900/15 px-4 text-sm font-semibold text-ink-900 hover:bg-cream-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
          >
            Request a meal
          </Link>
        </div>

        {loading && (
          <p className="mt-7 flex items-center gap-2 text-sm text-ink-900/60" role="status">
            <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
            Loading current offerings...
          </p>
        )}

        {!loading && error && (
          <div className="mt-7 rounded-md border border-clay-500/25 bg-cream-50 p-4">
            <p className="text-sm text-red-700" role="alert">{error}</p>
            <button
              type="button"
              onClick={() => void loadOfferings()}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-ink-900/15 px-3 text-sm font-semibold text-ink-900 hover:bg-white"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && offerings.length === 0 && (
          <Card className="mt-7 border border-ink-900/10 bg-cream-50 p-5 shadow-none sm:p-6">
            <p className="text-sm font-semibold text-ink-900">
              No cooks have published meals yet.
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-900/65">
              Here are examples of meals customers can request. These are ideas,
              not live cook offers or customer ratings.
            </p>
            <ul className="mt-4 grid gap-2 text-sm text-ink-900/75 sm:grid-cols-2 lg:grid-cols-3">
              {["Sadza, beef and muriwo", "Rice, chicken and vegetables", "Vegetable stew with rice"].map((meal) => (
                <li key={meal} className="rounded-md border border-ink-900/10 bg-white px-3 py-3">
                  {meal}
                  <span className="mt-1 block text-xs text-ink-900/50">Example meal</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {!loading && !error && offerings.length > 0 && (
          <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offerings.map((offering) => (
              <li key={offering.id}>
                <Card className="h-full border border-ink-900/10 p-4 shadow-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <Utensils
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-clay-500"
                      />
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-ink-900">
                          {offering.name}
                        </h3>
                        <p className="mt-1 break-words text-sm text-ink-900/60">
                          {offering.cook.display_name}
                        </p>
                        {offering.cook.rating && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-ink-900/60">
                            <Star aria-hidden="true" className="size-3.5 fill-saffron-500 text-saffron-500" />
                            <span className="font-semibold text-ink-900">
                              {offering.cook.rating.average_stars.toFixed(1)}
                            </span>
                            <span>
                              ({offering.cook.rating.rating_count} {offering.cook.rating.rating_count === 1 ? "rating" : "ratings"})
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-ink-900">
                      ${Number(offering.price).toFixed(2)}
                    </span>
                  </div>
                  {offering.description && (
                    <p className="mt-3 text-sm leading-5 text-ink-900/70">
                      {offering.description}
                    </p>
                  )}
                  {offering.cook.bio && (
                    <p className="mt-3 border-t border-ink-900/10 pt-3 text-xs leading-5 text-ink-900/60">
                      {offering.cook.bio}
                    </p>
                  )}
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-900/55">
                    <MapPin aria-hidden="true" className="size-3.5" />
                    Serves {offering.cook.supported_hubs.join(", ")}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
