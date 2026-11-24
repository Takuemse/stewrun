"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { ArrowLeft, ArrowRight, MapPin, RefreshCw, Star } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SUPPORTED_PICKUP_HUBS } from "@/lib/validate-supported-hubs";
import { getMealImage } from "@/lib/meal-image";

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

type HubFilter = "All hubs" | (typeof SUPPORTED_PICKUP_HUBS)[number];

const HUB_FILTERS: HubFilter[] = ["All hubs", ...SUPPORTED_PICKUP_HUBS];

const ILLUSTRATIVE_IMAGES = [
  {
    src: "/images/sadza-beef-stew.jpg",
    title: "Sadza, beef stew and muriwo",
  },
  {
    src: "/images/grilled-chicken-rice.jpg",
    title: "Grilled chicken, rice and vegetables",
  },
  {
    src: "/images/sadza-braaied-meat.jpg",
    title: "Sadza and braaied meat",
  },
  {
    src: "/images/rice-beef-stew.jpg",
    title: "Rice and beef stew",
  },
  {
    src: "/images/sadza-beans-chicken.jpg",
    title: "Sadza, beans and chicken",
  },
  {
    src: "/images/roasted-chicken-salad.jpg",
    title: "Roasted chicken with potatoes and salad",
  },
] as const;

function getOfferingImage(offering: Offering, index: number) {
  void index;
  return getMealImage(offering.name);
}

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
      SUPPORTED_PICKUP_HUBS.includes(
        hub as (typeof SUPPORTED_PICKUP_HUBS)[number],
      ),
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

function MealImage({
  src,
  sizes,
  alt = "",
}: {
  src: string;
  sizes: string;
  alt?: string;
}) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-cream-100">
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      />
      <span className="absolute bottom-3 left-3 rounded-sm bg-ink-900/75 px-2 py-1 text-[10px] font-medium tracking-wide text-white">
        Illustrative photo
      </span>
    </div>
  );
}

function ExpandableText({
  text,
  containerClassName,
  textClassName,
}: {
  text: string;
  containerClassName?: string;
  textClassName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const canExpand = text.length > 105;

  return (
    <div className={containerClassName}>
      <p
        id={textId}
        className={`${textClassName} ${
          canExpand && !expanded ? "line-clamp-2" : ""
        }`}
      >
        {text}
      </p>

      {canExpand && (
        <button
          type="button"
          aria-controls={textId}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 inline-flex min-h-7 items-center text-xs font-semibold text-clay-600 underline-offset-4 transition-colors hover:text-clay-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

export default function PublicMarketplace({
  showAll = false,
}: {
  showAll?: boolean;
}) {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selectedHub, setSelectedHub] = useState<HubFilter>("All hubs");
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

  const filteredOfferings =
    selectedHub === "All hubs"
      ? offerings
      : offerings.filter((offering) =>
          offering.cook.supported_hubs.includes(selectedHub),
        );

  const displayedOfferings = showAll
    ? filteredOfferings
    : filteredOfferings.slice(0, 6);

  const imageSizes =
    "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw";

  return (
    <section
      id="marketplace"
      aria-labelledby="marketplace-heading"
      className="scroll-mt-6 border-y border-ink-900/10 bg-cream-50"
    >
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.8fr)] lg:gap-12">
          <div className="flex flex-col lg:sticky lg:top-24 lg:self-start">
            {showAll && (
              <Link
                href="/"
                className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-900 transition-colors hover:text-clay-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Back to homepage
              </Link>
            )}

            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay-600">
              {showAll ? "Harare food marketplace" : "Local offerings"}
            </p>

            <h2
              id="marketplace-heading"
              className="mt-4 max-w-lg font-display text-4xl leading-tight tracking-tight text-ink-900 sm:text-5xl"
            >
              {showAll
                ? "Explore meals from Harare cooks."
                : "See what Harare cooks are making."}
            </h2>

            <p className="mt-5 max-w-md text-base leading-7 text-ink-900/75">
              Discover meals published by local cooks and caterers. Use these
              dishes as inspiration, or describe something different with Ziva
              and set your own budget.
            </p>

            <div className="mt-7 border-l-2 border-saffron-500 pl-4">
              <p className="font-display text-lg text-ink-900">
                Eat local. Enjoy Harare.
              </p>
              <p className="mt-1 text-xs leading-5 text-ink-900/55">
                Browse first. Choose your meal and pickup hub when you&apos;re
                ready to make a request.
              </p>
            </div>

            <p className="mt-8 text-xs leading-5 text-ink-900/50">
              Food photographs are illustrative examples and may differ from
              the actual meals prepared by cooks.
            </p>
          </div>

          <div className="min-w-0">
            {!loading && !error && offerings.length > 0 && (
              <div className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-900/55">
                    Browse by pickup hub
                  </p>

                  {!showAll && (
                    <Link
                      href="/meals"
                      className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-clay-600 transition-colors hover:text-clay-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
                    >
                      Explore all meals
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  )}
                </div>

                <div
                  className="mt-3 flex flex-wrap gap-2"
                  aria-label="Filter meals by pickup hub"
                >
                  {HUB_FILTERS.map((hub) => {
                    const active = selectedHub === hub;

                    return (
                      <button
                        key={hub}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedHub(hub)}
                        className={`min-h-10 rounded-full border px-4 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 ${
                          active
                            ? "border-clay-500 bg-clay-500 text-white"
                            : "border-ink-900/15 bg-white text-ink-900/70 hover:border-clay-500 hover:text-clay-700"
                        }`}
                      >
                        {hub}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {loading && (
              <p
                className="flex items-center gap-2 py-6 text-sm text-ink-900/60"
                role="status"
              >
                <RefreshCw
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                Loading current offerings...
              </p>
            )}

            {!loading && error && (
              <div className="rounded-md border border-clay-500/25 bg-white p-5">
                <p className="text-sm text-red-700" role="alert">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => void loadOfferings()}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-ink-900/15 px-3 text-sm font-semibold text-ink-900 hover:bg-cream-50"
                >
                  <RefreshCw aria-hidden="true" className="size-4" />
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && offerings.length === 0 && (
              <>
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-900/55">
                    Meal inspiration
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink-900/60">
                    No cooks have published meals yet. Here are some examples
                    of the kind of food you could request.
                  </p>
                </div>

                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {ILLUSTRATIVE_IMAGES.map((meal) => (
                    <li key={meal.src}>
                      <Card className="group h-full overflow-hidden border border-ink-900/10 bg-white p-0 shadow-none">
                        <MealImage
                          src={meal.src}
                          sizes={imageSizes}
                          alt={`Illustrative photo: ${meal.title}`}
                        />
                        <div className="p-4">
                          <h3 className="font-display text-lg leading-snug text-ink-900">
                            {meal.title}
                          </h3>
                          <p className="mt-2 text-xs text-ink-900/50">
                            Example meal idea
                          </p>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!loading &&
              !error &&
              offerings.length > 0 &&
              filteredOfferings.length === 0 && (
                <div className="rounded-md border border-ink-900/10 bg-white p-6">
                  <p className="text-sm font-semibold text-ink-900">
                    No published meals for {selectedHub} yet.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink-900/60">
                    Try another pickup hub to see its available offerings.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedHub("All hubs")}
                    className="mt-4 min-h-10 rounded-full border border-ink-900/15 px-4 text-sm font-semibold text-ink-900 hover:bg-cream-50"
                  >
                    Show all hubs
                  </button>
                </div>
              )}

            {!loading && !error && displayedOfferings.length > 0 && (
              <>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {displayedOfferings.map((offering, index) => {
                    const image = getOfferingImage(offering, index);

                    return (
                      <li key={offering.id}>
                        <Card className="group h-full overflow-hidden border border-ink-900/10 bg-white p-0 shadow-none transition-shadow duration-200 hover:shadow-sm">
                          {image ? (
                            <>
                              <MealImage
                                src={image.src}
                                sizes={imageSizes}
                                alt={image.alt}
                              />
                              <p className="border-b border-ink-900/10 px-4 py-2 text-[11px] font-medium text-ink-900/55">
                                Illustrative photo
                              </p>
                            </>
                          ) : (
                            <div
                              className="aspect-[4/3] w-full bg-cream-100"
                              aria-label="No illustrative photo available"
                              role="img"
                            />
                          )}

                          <div className="flex h-full flex-col p-4">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="min-w-0 break-words font-display text-lg leading-snug text-ink-900">
                                {offering.name}
                              </h3>

                              <p className="shrink-0 text-sm font-semibold tabular-nums text-clay-700">
                                ${Number(offering.price).toFixed(2)}
                                <span className="block text-right text-[10px] font-normal text-ink-900/50">
                                  / plate
                                </span>
                              </p>
                            </div>

                            <p className="mt-2 text-xs font-medium text-ink-900/60">
                              {offering.cook.display_name}
                            </p>

                            {offering.cook.rating && (
                              <p className="mt-2 flex items-center gap-1 text-xs text-ink-900/55">
                                <Star
                                  aria-hidden="true"
                                  className="size-3.5 fill-saffron-500 text-saffron-500"
                                />
                                <span className="font-semibold text-ink-900">
                                  {offering.cook.rating.average_stars.toFixed(1)}
                                </span>
                                <span>
                                  ({offering.cook.rating.rating_count}{" "}
                                  {offering.cook.rating.rating_count === 1
                                    ? "rating"
                                    : "ratings"}
                                  )
                                </span>
                              </p>
                            )}

                            {offering.description && (
                              <ExpandableText
                                text={offering.description}
                                containerClassName="mt-3"
                                textClassName="text-sm leading-5 text-ink-900/65"
                              />
                            )}

                            {offering.cook.bio && (
                              <ExpandableText
                                text={offering.cook.bio}
                                containerClassName="mt-3 border-t border-ink-900/10 pt-3"
                                textClassName="text-xs leading-5 text-ink-900/55"
                              />
                            )}

                            <p className="mt-auto flex items-start gap-1.5 border-t border-ink-900/10 pt-3 text-xs leading-5 text-ink-900/55">
                              <MapPin
                                aria-hidden="true"
                                className="mt-0.5 size-3.5 shrink-0"
                              />
                              <span>
                                Serves {offering.cook.supported_hubs.join(", ")}
                              </span>
                            </p>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>

                {!showAll && filteredOfferings.length > 6 && (
                  <div className="mt-6 text-center">
                    <Link
                      href="/meals"
                      className="inline-flex min-h-11 items-center justify-center gap-2 border-b border-clay-500 px-1 text-sm font-semibold text-clay-600 transition-colors hover:text-clay-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
                    >
                      Explore all {filteredOfferings.length} meals
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
