"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { RefreshCw, UserRound } from "lucide-react";

import AccountSignOut from "@/components/account-sign-out";
import NotificationBell from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  SUPPORTED_PICKUP_HUBS,
  type SupportedPickupHub,
} from "@/lib/validate-supported-hubs";

type CookProfile = {
  display_name: string;
  bio: string | null;
  is_available: boolean;
  supported_hubs: SupportedPickupHub[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isProfile(value: unknown): value is CookProfile {
  return (
    isRecord(value) &&
    typeof value.display_name === "string" &&
    (typeof value.bio === "string" || value.bio === null) &&
    typeof value.is_available === "boolean" &&
    Array.isArray(value.supported_hubs) &&
    value.supported_hubs.every((hub) =>
      SUPPORTED_PICKUP_HUBS.includes(hub as SupportedPickupHub),
    )
  );
}

async function fetchCookProfile(): Promise<CookProfile> {
  const response = await fetch("/api/cook/profile", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error(
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : "Unable to load your profile.",
    );
  }

  if (!isRecord(payload) || !isProfile(payload.profile)) {
    throw new Error("The cook profile response was invalid.");
  }

  return payload.profile;
}

export default function CookProfilePage() {
  const [profile, setProfile] = useState<CookProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await fetchCookProfile());
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your profile.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void fetchCookProfile()
      .then((loadedProfile) => {
        if (active) setProfile(loadedProfile);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your profile.",
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

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/cook/profile", {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Unable to save your profile.",
        );
      }

      if (!isRecord(payload) || !isProfile(payload.profile)) {
        throw new Error("The saved profile response was invalid.");
      }

      setProfile(payload.profile);
      setSuccess("Your cook profile has been saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your profile.",
      );
    } finally {
      setSaving(false);
    }
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
              className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-ink-900/70 hover:bg-cream-50"
            >
              Menu
            </Link>
            <Link
              href="/cook/profile"
              aria-current="page"
              className="inline-flex min-h-10 items-center rounded-md border border-ink-900/10 px-3 text-sm font-semibold text-ink-900"
            >
              Profile
            </Link>
            <NotificationBell />
            <AccountSignOut />
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="border-b border-ink-900/10 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay-500">
            Cook workspace
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900">
            Your cook profile
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-900/65">
            Set the public name and introduction customers see beside your
            published meals, and control whether you receive new requests.
          </p>
        </div>

        {loading && (
          <p className="mt-6 flex items-center gap-2 text-sm text-ink-900/60" role="status">
            <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
            Loading your profile...
          </p>
        )}

        {error && (
          <div className="mt-6 rounded-md border border-red-700/20 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                void loadProfile();
              }}
              className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-md border border-red-700/20 px-3 font-semibold hover:bg-white"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Retry
            </button>
          </div>
        )}

        {success && (
          <p className="mt-6 rounded-md border border-sage-500/30 bg-sage-500/10 p-4 text-sm text-sage-700" role="status">
            {success}
          </p>
        )}

        {!loading && profile && (
          <Card className="mt-6 border border-ink-900/10 p-4 shadow-none sm:p-6">
            <form onSubmit={handleSave} className="space-y-5">
              <div className="flex items-center gap-3 border-b border-ink-900/10 pb-5">
                <span className="flex size-10 items-center justify-center rounded-md bg-cream-50">
                  <UserRound aria-hidden="true" className="size-5 text-clay-500" />
                </span>
                <div>
                  <h2 className="font-semibold text-ink-900">Public details</h2>
                  <p className="text-xs text-ink-900/55">
                    These details are shown only with published meals.
                  </p>
                </div>
              </div>

              <label className="block space-y-2 text-sm font-medium text-ink-900">
                Display name
                <Input
                  value={profile.display_name}
                  onChange={(event) =>
                    setProfile((current) =>
                      current
                        ? { ...current, display_name: event.target.value }
                        : current,
                    )
                  }
                  minLength={2}
                  maxLength={100}
                  required
                  className="min-h-11 rounded-md"
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink-900">
                Introduction
                <textarea
                  value={profile.bio ?? ""}
                  onChange={(event) =>
                    setProfile((current) =>
                      current ? { ...current, bio: event.target.value } : current,
                    )
                  }
                  maxLength={500}
                  rows={4}
                  className="w-full rounded-md border border-ink-900/20 bg-white px-3 py-2 text-sm font-normal text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                  placeholder="Share a little about the food you prepare."
                />
              </label>

              <label className="flex items-start gap-3 rounded-md border border-ink-900/10 bg-cream-50 p-4">
                <input
                  type="checkbox"
                  checked={profile.is_available}
                  onChange={(event) =>
                    setProfile((current) =>
                      current
                        ? { ...current, is_available: event.target.checked }
                        : current,
                    )
                  }
                  className="mt-0.5 size-4 accent-clay-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink-900">
                    Accept new meal requests
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-ink-900/60">
                    When paused, your published meals stay visible, but new
                    requests are not sent to your cook workspace.
                  </span>
                </span>
              </label>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-ink-900">
                  Pickup hubs you serve
                </legend>
                <p className="text-xs leading-5 text-ink-900/60">
                  You will only receive new requests for the hubs you select.
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {SUPPORTED_PICKUP_HUBS.map((hub) => {
                    const checked = profile.supported_hubs.includes(hub);
                    return (
                      <label
                        key={hub}
                        className="flex min-h-12 items-center gap-3 rounded-md border border-ink-900/10 bg-white px-3 text-sm font-medium text-ink-900"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setProfile((current) => {
                              if (!current) return current;
                              const supported_hubs = checked
                                ? current.supported_hubs.filter(
                                    (currentHub) => currentHub !== hub,
                                  )
                                : [...current.supported_hubs, hub];
                              return { ...current, supported_hubs };
                            })
                          }
                          className="size-4 accent-clay-500"
                        />
                        {hub}
                      </label>
                    );
                  })}
                </div>
                {profile.supported_hubs.length === 0 && (
                  <p className="text-sm text-clay-500" role="alert">
                    Select at least one pickup hub to save your profile.
                  </p>
                )}
              </fieldset>

              <Button
                type="submit"
                disabled={saving || profile.supported_hubs.length === 0}
                className="w-full rounded-md sm:w-auto"
              >
                {saving ? "Saving..." : "Save profile"}
              </Button>
            </form>
          </Card>
        )}
      </section>
    </main>
  );
}
