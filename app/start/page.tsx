"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveCustomerRequestDraft,
  type CustomerRequestDraft,
} from "@/lib/customer-request-draft";
import { createClient } from "@/lib/supabase/client";

const hubs: CustomerRequestDraft["pickupHub"][] = [
  "Joina City",
  "Eastgate",
  "Avondale",
];

const wholeMeals = [
  "Sadza and beef",
  "Sadza and chicken",
  "Rice and beef",
  "Rice and chicken",
];

const mealParts = ["Sadza", "Rice", "Beef", "Chicken", "Vegetables"];

function getHarareDateParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }

  return values;
}

function getEarliestPickupDate(): string {
  const parts = getHarareDateParts();
  let date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  if (parts.hour >= 10) date = new Date(date.getTime() + 86_400_000);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export default function StartRequestPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [minPickupDate, setMinPickupDate] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [budgetPerPlate, setBudgetPerPlate] = useState("");
  const [pickupHub, setPickupHub] =
    useState<CustomerRequestDraft["pickupHub"] | "">("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(Boolean(data.session));
    });

    return () => {
      active = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setMinPickupDate(getEarliestPickupDate()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function addMealText(value: string) {
    setDescription((current) => {
      const next = current.trim();
      if (!next) return value;
      if (next.toLowerCase().includes(value.toLowerCase())) return next;
      return `${next}, ${value}`;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const parsedQuantity = Number(quantity);
    const parsedBudget = Number(budgetPerPlate);

    if (!description.trim()) {
      setError("Choose a meal idea or describe what you would like.");
      return;
    }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 20) {
      setError("Choose between 1 and 20 plates.");
      return;
    }
    if (!pickupHub || !pickupDate || !pickupTime) {
      setError("Choose your pickup hub, date, and time.");
      return;
    }
    if (pickupDate < getEarliestPickupDate()) {
      setError("That pickup date is no longer available. Choose a later date.");
      return;
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(budgetPerPlate.trim()) || !Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      setError("Enter a budget per plate in USD, such as 2.50.");
      return;
    }

    const draft: CustomerRequestDraft = {
      description: description.trim(),
      quantity: parsedQuantity,
      budgetPerPlate: parsedBudget.toFixed(2),
      pickupHub,
      pickupDate,
      pickupTime,
    };

    setSaving(true);
    saveCustomerRequestDraft(draft);
    router.push(
      hasSession ? "/dashboard" : "/register?role=customer&next=/dashboard",
    );
  }

  return (
    <main className="min-h-screen bg-cream-50 text-ink-900">
      <header className="border-b border-ink-900/10 bg-white">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-clay-500 font-display text-lg font-semibold text-white">S</span>
            <span className="font-display text-xl font-semibold">StewRun</span>
          </Link>
          <Link href="/login" className="min-h-11 inline-flex items-center px-2 text-sm font-semibold text-clay-700 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl items-start gap-8 px-5 py-7 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section>
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-ink-900/70 hover:text-clay-700">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to StewRun
          </Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-sage-600">
            Plan your lunch
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Start with where and when.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-900/70 sm:text-base">
            Choose a pickup hub and time, then tell local cooks what you would like.
            You can review the request before it is sent.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-6 rounded-xl border border-ink-900/10 bg-white p-5 sm:p-7">
            <fieldset>
              <legend className="text-sm font-semibold">1. Pickup hub</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {hubs.map((hub) => (
                  <label key={hub} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium ${pickupHub === hub ? "border-clay-500 bg-clay-500/5" : "border-ink-900/15"}`}>
                    <input type="radio" name="pickup-hub" value={hub} checked={pickupHub === hub} onChange={() => setPickupHub(hub)} required className="size-4 accent-clay-500" />
                    <MapPin aria-hidden="true" className="size-4 text-clay-500" />
                    {hub}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-900/60">These are the current pilot hub names. Exact collection points will be confirmed before launch.</p>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pickup-date" className="mb-2 block text-sm font-semibold">2. Pickup date</label>
                <Input id="pickup-date" type="date" min={minPickupDate} value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} required className="min-h-12" />
              </div>
              <div>
                <label htmlFor="pickup-time" className="mb-2 block text-sm font-semibold">Pickup time</label>
                <Input id="pickup-time" type="time" min="08:00" max="23:59" value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} required className="min-h-12" />
                <p className="mt-1 text-xs leading-5 text-ink-900/55">Choose the time you plan to collect. The pilot currently records an exact time, not a time window.</p>
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold">3. What would you like to eat?</legend>
              <p className="mt-1 text-xs leading-5 text-ink-900/60">Tap a whole meal or add ingredients. You can also type in your own words.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {wholeMeals.map((meal) => (
                  <button key={meal} type="button" onClick={() => setDescription(meal)} className="min-h-10 rounded-full border border-ink-900/15 bg-cream-50 px-3 text-xs font-medium text-ink-900 hover:border-sage-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500">
                    {meal}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {mealParts.map((part) => (
                  <button key={part} type="button" onClick={() => addMealText(part)} className="min-h-10 rounded-full border border-sage-500/30 bg-white px-3 text-xs font-medium text-sage-700 hover:bg-sage-500/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-600">
                    + {part}
                  </button>
                ))}
              </div>
              <label htmlFor="meal-description" className="sr-only">Describe your meal</label>
              <textarea id="meal-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} placeholder="For example: Ndinoda sadza nenyama yemombe nemuriwo." className="mt-4 min-h-28 w-full rounded-lg border border-ink-900/20 bg-white px-4 py-3 text-base leading-6 text-ink-900 placeholder:text-ink-900/45 focus:border-clay-500 focus:outline-none focus:ring-2 focus:ring-clay-500/25" />
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="plate-count" className="mb-2 block text-sm font-semibold">4. Number of plates</label>
                <Input id="plate-count" type="number" inputMode="numeric" min="1" max="20" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required className="min-h-12" />
              </div>
              <div>
                <label htmlFor="budget-per-plate" className="mb-2 block text-sm font-semibold">5. Budget per plate (USD)</label>
                <div className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-900/60">$</span>
                  <Input id="budget-per-plate" type="number" inputMode="decimal" min="0.01" max="99999999.99" step="0.01" value={budgetPerPlate} onChange={(event) => setBudgetPerPlate(event.target.value)} placeholder="2.50" required className="min-h-12 pl-8" />
                </div>
                <p className="mt-1 text-xs leading-5 text-ink-900/55">This guides cooks; each cook sets their own price.</p>
              </div>
            </div>

            {error && <p role="alert" className="rounded-lg border border-clay-500/25 bg-clay-500/5 px-4 py-3 text-sm text-ink-900">{error}</p>}

            <div>
              <Button type="submit" disabled={saving} className="min-h-12 w-full text-sm font-semibold sm:w-auto sm:min-w-64">
                {saving ? "Saving your request…" : "Continue to your account"}
                {!saving && <ArrowRight aria-hidden="true" className="size-4" />}
              </Button>
              <p className="mt-2 text-xs leading-5 text-ink-900/55">Your choices stay on this device while you create an account or sign in. The request is not sent until you review and submit it.</p>
            </div>
          </form>
        </section>

        <aside className="hidden lg:block">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-cream-100">
            <Image src="/images/stewrun-hero-lunch.webp" alt="Sadza, beef stew and leafy greens, shown as an example meal." fill sizes="288px" className="object-cover" />
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-900/55">Example meal image. Cook offers show the actual meals they propose.</p>
        </aside>
      </div>
    </main>
  );
}
