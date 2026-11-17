"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { RefreshCw, Utensils } from "lucide-react";

import AccountSignOut from "@/components/account-sign-out";
import NotificationBell from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Offering = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  available: boolean;
};

type OfferingDraft = Omit<Offering, "id">;

const EMPTY_DRAFT: OfferingDraft = {
  name: "",
  description: "",
  price: 0,
  available: false,
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
    (typeof value.description === "string" || value.description === null) &&
    (typeof value.price === "number" || typeof value.price === "string") &&
    typeof value.available === "boolean"
  );
}

function normalizeDraft(draft: OfferingDraft): OfferingDraft {
  return {
    ...draft,
    name: draft.name.trim(),
    description:
      typeof draft.description === "string"
        ? draft.description.trim() || null
        : null,
    price: Number(draft.price),
  };
}

function formatPrice(price: number | string) {
  return `$${Number(price).toFixed(2)}`;
}

async function fetchOfferings(): Promise<Offering[]> {
  const response = await fetch("/api/cook/menu?manage=1", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error(
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : "Unable to load your offerings.",
    );
  }

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.menu) ||
    !payload.menu.every(isOffering)
  ) {
    throw new Error("The offerings response was invalid.");
  }

  return payload.menu;
}

export default function CookMenuPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [draft, setDraft] = useState<OfferingDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadOfferings = useCallback(async () => {
    try {
      setOfferings(await fetchOfferings());
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your offerings.",
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
              : "Unable to load your offerings.",
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

  async function sendOffering(
    method: "POST" | "PATCH",
    body: unknown,
  ): Promise<Offering> {
    const response = await fetch("/api/cook/menu", {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json();

    if (!response.ok) {
      throw new Error(
        isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : "Unable to save this offering.",
      );
    }

    if (!isRecord(payload) || !isOffering(payload.item)) {
      throw new Error("The saved offering response was invalid.");
    }

    return payload.item;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const item = await sendOffering("POST", normalizeDraft(draft));
      setOfferings((current) =>
        [...current, item].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setDraft(EMPTY_DRAFT);
      setSuccess(
        item.available
          ? "Offering created and published."
          : "Offering saved as a draft.",
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to save this offering.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(offering: Offering) {
    setSavingId(offering.id);
    setError("");
    setSuccess("");

    try {
      const updated = await sendOffering("PATCH", {
        id: offering.id,
        ...normalizeDraft(offering),
      });
      setOfferings((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccess(
        updated.available
          ? "Offering updated and published."
          : "Offering updated and unpublished.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update this offering.",
      );
    } finally {
      setSavingId(null);
    }
  }

  function updateOffering(id: string, updates: Partial<Offering>) {
    setOfferings((current) =>
      current.map((offering) =>
        offering.id === id ? { ...offering, ...updates } : offering,
      ),
    );
    setSuccess("");
  }

  return (
    <main className="min-h-screen bg-cream-50">
      <header className="border-b border-ink-900/10 bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Link
            href="/"
            className="font-display text-xl font-semibold tracking-tight text-ink-900"
          >
            StewRun
          </Link>
          <nav
            aria-label="Cook workspace"
            className="flex flex-wrap items-center justify-end gap-2 sm:gap-3"
          >
            <Link
              href="/cook"
              className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-ink-900/70 hover:bg-cream-50"
            >
              Requests
            </Link>
            <Link
              href="/cook/orders"
              className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-ink-900/70 hover:bg-cream-50"
            >
              Orders
            </Link>
            <Link
              href="/cook/menu"
              aria-current="page"
              className="inline-flex min-h-10 items-center rounded-md border border-ink-900/10 px-3 text-sm font-semibold text-ink-900"
            >
              Menu
            </Link>
            <Link
              href="/cook/profile"
              className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-ink-900/70 hover:bg-cream-50"
            >
              Profile
            </Link>
            <NotificationBell />
            <AccountSignOut />
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col justify-between gap-4 border-b border-ink-900/10 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay-500">
              Cook workspace
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900">
              Your offerings
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-900/65">
              Publish meals customers can browse, or keep offerings as drafts
              while you prepare them.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setError("");
              void loadOfferings();
            }}
            disabled={loading || creating || savingId !== null}
            className="w-full shrink-0 sm:w-auto"
          >
            <RefreshCw aria-hidden="true" className="mr-2 size-4" />
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {error && (
          <div className="mt-5 rounded-md border border-red-700/20 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                void loadOfferings();
              }}
              className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-md border border-red-700/20 px-3 font-semibold hover:bg-white"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Retry
            </button>
          </div>
        )}

        {success && (
          <p
            className="mt-5 rounded-md border border-sage-500/30 bg-sage-500/10 p-4 text-sm text-sage-700"
            role="status"
          >
            {success}
          </p>
        )}

        <Card className="mt-6 border border-ink-900/10 p-4 shadow-none sm:p-6">
          <h2 className="font-display text-xl font-semibold text-ink-900">
            Add an offering
          </h2>
          <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-ink-900">
              Meal name
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                minLength={2}
                maxLength={150}
                required
                className="min-h-11 rounded-md"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-ink-900">
              Price (USD)
              <Input
                type="number"
                min="0.01"
                max="99999999.99"
                step="0.01"
                value={draft.price || ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    price: event.target.value === "" ? 0 : Number(event.target.value),
                  }))
                }
                required
                className="min-h-11 rounded-md"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-ink-900 sm:col-span-2">
              Description
              <textarea
                value={draft.description ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                maxLength={500}
                rows={3}
                className="w-full rounded-md border border-ink-900/20 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink-900 sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.available}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    available: event.target.checked,
                  }))
                }
                className="size-4 accent-clay-500"
              />
              Publish this offering for customers to browse
            </label>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={creating || loading}
                className="w-full rounded-md sm:w-auto"
              >
                {creating ? "Saving..." : "Save offering"}
              </Button>
            </div>
          </form>
        </Card>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink-900">
              Saved offerings
            </h2>
            {!loading && (
              <span className="text-xs text-ink-900/55">
                {offerings.length} {offerings.length === 1 ? "offering" : "offerings"}
              </span>
            )}
          </div>

          {loading && (
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-900/60" role="status">
              <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
              Loading your offerings...
            </p>
          )}

          {!loading && offerings.length === 0 && !error && (
            <Card className="mt-4 border border-dashed border-ink-900/15 bg-white text-sm text-ink-900/65 shadow-none">
              You have not saved any offerings yet.
            </Card>
          )}

          <ul className="mt-4 space-y-3">
            {offerings.map((offering) => (
              <li key={offering.id}>
                <Card className="border border-ink-900/10 p-4 shadow-none sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Utensils aria-hidden="true" className="size-4 text-clay-500" />
                      <h3 className="text-sm font-semibold text-ink-900">
                        {formatPrice(offering.price)}
                      </h3>
                    </div>
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        offering.available
                          ? "bg-sage-500/10 text-sage-700"
                          : "bg-ink-900/5 text-ink-900/60"
                      }`}
                    >
                      {offering.available ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5 text-xs font-semibold text-ink-900/70">
                      Meal name
                      <Input
                        value={offering.name}
                        onChange={(event) =>
                          updateOffering(offering.id, { name: event.target.value })
                        }
                        maxLength={150}
                        className="min-h-10 rounded-md text-sm"
                      />
                    </label>
                    <label className="space-y-1.5 text-xs font-semibold text-ink-900/70">
                      Price (USD)
                      <Input
                        type="number"
                        min="0.01"
                        max="99999999.99"
                        step="0.01"
                        value={offering.price}
                        onChange={(event) =>
                          updateOffering(offering.id, {
                            price:
                              event.target.value === ""
                                ? 0
                                : Number(event.target.value),
                          })
                        }
                        className="min-h-10 rounded-md text-sm"
                      />
                    </label>
                    <label className="space-y-1.5 text-xs font-semibold text-ink-900/70 sm:col-span-2">
                      Description
                      <textarea
                        value={offering.description ?? ""}
                        onChange={(event) =>
                          updateOffering(offering.id, {
                            description: event.target.value,
                          })
                        }
                        maxLength={500}
                        rows={2}
                        className="w-full rounded-md border border-ink-900/20 bg-white px-3 py-2 text-sm font-normal text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                      />
                    </label>
                    <label className="flex min-h-10 items-center gap-2 text-sm text-ink-900 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={offering.available}
                        onChange={(event) =>
                          updateOffering(offering.id, {
                            available: event.target.checked,
                          })
                        }
                        className="size-4 accent-clay-500"
                      />
                      Published for customers
                    </label>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      disabled={savingId !== null || creating || loading}
                      onClick={() => void handleSave(offering)}
                      className="w-full rounded-md sm:w-auto"
                    >
                      {savingId === offering.id ? "Saving..." : "Save changes"}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
