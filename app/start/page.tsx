"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";

import CustomerNavigation from "@/components/customer-navigation";
import { getMealImage } from "@/lib/meal-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  clearCustomerRequestDraft,
} from "@/lib/customer-request-draft";
import {
  clearParsedMealDraft as clearMealHandoff,
  readParsedMealDraft,
  saveParsedMealDraft,
  type ParsedMealDraft,
} from "@/lib/parsed-meal-draft";
import {
  getMealRequestPlateCount,
  mergeDuplicateMealRequestLines,
  validateMealRequestLines,
  type MealRequestLine,
} from "@/lib/meal-request-lines";
import { createClient } from "@/lib/supabase/client";

const HUBS = ["Joina City", "Eastgate", "Avondale"] as const;
type PickupHub = (typeof HUBS)[number];
type MealRow = { id: string; name: string; quantity: string };
type SavedRequest = {
  id: string;
  items: MealRequestLine[];
  hub: PickupHub;
  pickup_date: string;
  pickup_time: string;
  offers_close_at: string;
};

const SUBMISSION_STORAGE_KEY = "stewrun:meal-request-submission";
const QUICK_MEALS = [
  "Sadza and beef",
  "Sadza and chicken",
  "Rice and beef",
  "Rice and chicken",
];
const MAX_PLATES = 20;
const CLAY = "var(--color-clay-500, #B4472B)";

let fallbackSubmission: { fingerprint: string; key: string } | null = null;

/* ── Layout rules are scoped here so nothing depends on Tailwind
      generating new utility classes. Mobile first. ──────────────────── */
const requestStyles = `
  .rq-shell{min-height:100dvh;
    padding-bottom:calc(4.5rem + env(safe-area-inset-bottom,0px));
    background:linear-gradient(180deg,#FDF4E9 0,#FAF5EF 360px)}
  .rq-wrap{max-width:1180px;margin:0 auto;padding:16px 16px 32px}
  .rq-grid{display:grid;gap:24px;align-items:start}
  .rq-main{min-width:0}

  .rq-back{display:inline-flex;align-items:center;gap:8px;min-height:44px;
    font-size:14px;font-weight:600;color:rgba(42,33,28,.7);text-decoration:none}
  .rq-back:hover{color:${CLAY}}
  .rq-tag{display:inline-block;margin-top:6px;padding:6px 14px;border-radius:999px;
    background:#fff;font-size:12px;font-weight:600;letter-spacing:.04em;
    box-shadow:0 2px 8px rgba(120,70,30,.08)}
  .rq-h1{margin:14px 0 0;font-size:clamp(30px,8.5vw,52px);line-height:1.06;
    letter-spacing:-.01em;font-weight:400;overflow-wrap:anywhere}
  .rq-rule{display:block;margin-top:14px;width:102px;height:4px;border-radius:999px;
    background:#E8A030}
  .rq-lead{margin:14px 0 0;max-width:560px;font-size:15px;line-height:1.6;
    color:rgba(42,33,28,.75);overflow-wrap:anywhere}

  .rq-form{margin-top:22px;display:flex;flex-direction:column;gap:26px;
    background:#fff;border-radius:24px;padding:20px 16px;
    box-shadow:0 18px 40px rgba(120,70,30,.12)}
  .rq-fs{border:0;margin:0;padding:0;min-width:0}
  .rq-step-title{display:flex;align-items:center;gap:12px;padding:0;margin:0;
    font-size:19px;line-height:1.25}
  .rq-num{flex:none;width:30px;height:30px;border-radius:50%;background:${CLAY};
    color:#fff;display:inline-flex;align-items:center;justify-content:center;
    font-family:var(--font-sans,Inter,system-ui,sans-serif);font-size:14px;font-weight:600}
  .rq-help{margin:8px 0 0;font-size:13px;line-height:1.5;color:rgba(42,33,28,.62)}

  .rq-hubs{display:grid;gap:10px;margin-top:14px;grid-template-columns:minmax(0,1fr)}
  .rq-hub{position:relative;display:flex;align-items:center;justify-content:center;
    gap:8px;min-height:52px;padding:0 12px;border-radius:999px;
    border:2px solid rgba(42,33,28,.15);background:#fff;font-size:15px;
    font-weight:600;cursor:pointer}
  .rq-hub.is-on{border-color:${CLAY};background:#FDF4E9}
  .rq-hub:hover{border-color:${CLAY}}
  .rq-hub input{position:absolute;inset:0;width:100%;height:100%;margin:0;
    opacity:0;cursor:pointer}
  .rq-hub:focus-within{outline:2px solid ${CLAY};outline-offset:2px}

  .rq-two{display:grid;gap:20px;grid-template-columns:minmax(0,1fr)}
  .rq-label{display:flex;align-items:center;gap:12px;font-size:19px;line-height:1.25}
  .rq-input{display:block;box-sizing:border-box;width:100%;min-width:0;min-height:54px;
    margin-top:12px;padding:0 16px;border-radius:16px;border:1.5px solid rgba(42,33,28,.18);
    background:#fff;font-family:inherit;font-size:16px;color:#2A211C}
  .rq-input:focus{outline:none;border-color:${CLAY};box-shadow:0 0 0 3px rgba(180,71,43,.2)}
  .rq-money{position:relative}
  .rq-money span{position:absolute;left:18px;top:calc(50% + 6px);transform:translateY(-50%);
    font-size:18px;color:${CLAY};pointer-events:none}
  .rq-money .rq-input{padding-left:36px}

  .rq-meals{display:flex;flex-direction:column;gap:12px;margin-top:14px}
  .rq-meal{display:grid;gap:12px;padding:14px;border-radius:18px;background:#FDF4E9;
    grid-template-columns:minmax(0,1fr)}
  .rq-meal .rq-input{margin-top:6px;background:#fff;min-height:48px}
  .rq-mini{display:block;font-size:12px;font-weight:600;color:rgba(42,33,28,.7)}
  .rq-meal-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
  .rq-stepper{display:flex;align-items:center;gap:10px}
  .rq-stepper output{min-width:28px;text-align:center;font-size:18px;font-weight:600}
  .rq-round{display:inline-flex;align-items:center;justify-content:center;width:44px;
    height:44px;border-radius:50%;cursor:pointer;background:#fff;color:#2A211C;
    border:1.5px solid rgba(42,33,28,.2)}
  .rq-round.is-solid{background:${CLAY};border-color:${CLAY};color:#fff}
  .rq-round:disabled{opacity:.4;cursor:not-allowed}
  .rq-round:focus-visible,.rq-ghost:focus-visible,.rq-chip:focus-visible,.rq-send:focus-visible{
    outline:2px solid ${CLAY};outline-offset:2px}
  .rq-remove{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 10px;
    border:0;background:none;font-size:14px;font-weight:600;color:${CLAY};cursor:pointer}

  .rq-addrow{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;
    gap:12px;margin-top:12px}
  .rq-ghost{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;
    border-radius:999px;border:1.5px dashed rgba(42,33,28,.3);background:#fff;
    font-size:14px;font-weight:600;color:#2A211C;cursor:pointer}
  .rq-ghost:disabled{opacity:.5;cursor:not-allowed}
  .rq-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  .rq-chip{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(42,33,28,.15);
    background:#fff;font-size:13px;font-weight:600;color:#2A211C;cursor:pointer}
  .rq-chip:hover{border-color:${CLAY}}
  .rq-chip:disabled{opacity:.5;cursor:not-allowed}

  .rq-error{margin:0;padding:12px 16px;border-radius:14px;
    border:1px solid rgba(180,71,43,.25);background:rgba(180,71,43,.05);
    font-size:14px;line-height:1.5;overflow-wrap:anywhere}
  .rq-foot{border-top:1px solid rgba(42,33,28,.1);padding-top:20px}
  .rq-send{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;
    min-height:58px;padding:0 28px;border:0;border-radius:999px;background:${CLAY};
    color:#fff;font-size:16px;font-weight:600;cursor:pointer}
  .rq-send:hover{filter:brightness(.95)}
  .rq-send:disabled{opacity:.6;cursor:not-allowed}
  .rq-note{margin:10px 0 0;font-size:13px;line-height:1.55;color:rgba(42,33,28,.62)}

  .rq-aside{display:flex;flex-direction:column;gap:20px;min-width:0}
  .rq-feature{display:none;background:#fff;border-radius:24px;overflow:hidden;
    box-shadow:0 18px 40px rgba(120,70,30,.12)}
  .rq-feature-img{position:relative;height:190px;background:linear-gradient(135deg,#E9C9A0,#B98A5E)}
  .rq-feature-body{padding:18px 20px 20px}
  .rq-next{background:#FDF4E9;border-radius:24px;padding:20px}
  .rq-next ul{margin:12px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;
    gap:12px;font-size:14px;line-height:1.5}
  .rq-next li{display:flex;gap:10px}
  .rq-next li::before{content:"";flex:none;margin-top:7px;width:8px;height:8px;
    border-radius:50%;background:#E8A030}
  .rq-ziva{display:flex;align-items:center;gap:14px;background:#fff;border-radius:24px;
    padding:16px 18px;box-shadow:0 8px 20px rgba(120,70,30,.1)}
  .rq-ziva-dot{flex:none;width:46px;height:46px;border-radius:50%;background:${CLAY};
    color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px}
  .rq-ziva a{display:inline-flex;align-items:center;min-height:44px;font-size:14px;
    font-weight:600;color:${CLAY};text-decoration:none}

  /* Very small phones (320px) */
  @media (max-width:360px){
    .rq-wrap{padding-left:12px;padding-right:12px}
    .rq-form{padding:16px 12px}
    .rq-step-title,.rq-label{font-size:17px}
  }
  @media (min-width:480px){
    .rq-hubs{grid-template-columns:repeat(3,minmax(0,1fr))}
  }
  @media (min-width:600px){
    .rq-two{grid-template-columns:1fr 1fr}
    .rq-meal{grid-template-columns:minmax(0,1fr) auto;align-items:end}
    .rq-meal-foot{gap:18px}
  }
  @media (min-width:640px){
    .rq-wrap{padding:24px 28px 48px}
    .rq-form{padding:30px;border-radius:28px}
    .rq-lead{font-size:16px}
  }
  @media (min-width:768px){
    .rq-feature{display:block}
  }
  @media (min-width:768px) and (max-width:1279px){
    .rq-aside{display:grid;grid-template-columns:1fr 1fr;align-items:start}
  }
  /* Desktop: sidebar from customer navigation is 15rem wide and fixed. */
  @media (min-width:1024px){
    .rq-shell{padding-left:15rem;padding-bottom:0}
    .rq-wrap{padding:32px 40px 56px}
  }
  @media (min-width:1280px){
    .rq-grid{grid-template-columns:minmax(0,1fr) 20rem;gap:32px}
    .rq-aside{display:flex;position:sticky;top:24px}
  }
`;

function getHarareParts() {
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
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  return values;
}

function getEarliestPickupDate() {
  const parts = getHarareParts();

  const date = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day + (parts.hour >= 10 ? 1 : 0),
    ),
  );

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSavedRequest(value: unknown): value is SavedRequest {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    !Array.isArray(value.items) ||
    value.items.length === 0
  ) {
    return false;
  }

  return (
    (HUBS as readonly unknown[]).includes(value.hub) &&
    typeof value.pickup_date === "string" &&
    typeof value.pickup_time === "string" &&
    typeof value.offers_close_at === "string" &&
    !Number.isNaN(Date.parse(value.offers_close_at)) &&
    value.items.every(
      (item) =>
        isRecord(item) &&
        typeof item.name === "string" &&
        typeof item.quantity === "number",
    )
  );
}

function getOrCreateIdempotencyKey(fingerprint: string) {
  try {
    const stored: unknown = JSON.parse(
      window.sessionStorage.getItem(SUBMISSION_STORAGE_KEY) ?? "null",
    );

    if (
      isRecord(stored) &&
      stored.fingerprint === fingerprint &&
      typeof stored.key === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        stored.key,
      )
    ) {
      fallbackSubmission = {
        fingerprint,
        key: stored.key,
      };

      return stored.key;
    }
  } catch {
    // Fall back to the in-memory key.
  }

  if (fallbackSubmission?.fingerprint === fingerprint) {
    return fallbackSubmission.key;
  }

  const key = crypto.randomUUID();

  fallbackSubmission = {
    fingerprint,
    key,
  };

  try {
    window.sessionStorage.setItem(
      SUBMISSION_STORAGE_KEY,
      JSON.stringify({ key, fingerprint }),
    );
  } catch {
    // The in-memory key still protects retries in this page session.
  }

  return key;
}

function formatPickupDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatDeadline(value: string) {
  const date = new Date(value);

  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)}, ${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)} Harare time`;
}

function pickMealImage(name: string): string | null {
  return getMealImage(name)?.src ?? null;
}

export default function StartRequestPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [authLoading, setAuthLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [mealDraft, setMealDraft] = useState<ParsedMealDraft | null>(null);
  const [rows, setRows] = useState<MealRow[]>([]);
  const [pickupHub, setPickupHub] = useState<PickupHub | "">("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [budgetPerPlate, setBudgetPerPlate] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedRequest, setSavedRequest] = useState<SavedRequest | null>(null);

  useEffect(() => {
    let active = true;

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setHasSession(Boolean(data.session));
          setAuthLoading(false);
        }
      })
      .catch(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const draft = readParsedMealDraft();

      if (draft) {
        setMealDraft(draft);
        setRows(
          draft.items.map((item, index) => ({
            id: `meal-${index}-${crypto.randomUUID()}`,
            name: item.name,
            quantity: String(item.quantity),
          })),
        );
        setPickupHub("");
        setPickupTime(draft.pickupTime ?? "12:00");
        setBudgetPerPlate(draft.budget ? draft.budget.toFixed(2) : "");
      }

      setPickupDate(getEarliestPickupDate());
      setDraftReady(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  function persistRows(nextRows: MealRow[]) {
    setRows(nextRows);
    setError("");

    if (!mealDraft) return;

    const items = nextRows
      .filter(
        (row) =>
          row.name.trim() &&
          Number.isInteger(Number(row.quantity)) &&
          Number(row.quantity) > 0,
      )
      .map((row) => ({
        name: row.name.trim(),
        quantity: Number(row.quantity),
      }));

    if (items.length) {
      saveParsedMealDraft({ ...mealDraft, items });
    }
  }

  function addMeal(name = "") {
    if (
      rows.length >= MAX_PLATES ||
      getMealRequestPlateCount(
        rows
          .filter((row) => row.name.trim())
          .map((row) => ({
            name: row.name,
            quantity: Number(row.quantity) || 0,
          })),
      ) >= MAX_PLATES
    ) {
      setError("A lunch request can include up to 20 plates in total.");
      return;
    }

    persistRows([
      ...rows,
      { id: crypto.randomUUID(), name, quantity: "1" },
    ]);
  }

  function updateMeal(id: string, updates: Partial<MealRow>) {
    persistRows(
      rows.map((row) =>
        row.id === id ? { ...row, ...updates } : row,
      ),
    );
  }

  function changePlates(row: MealRow, delta: 1 | -1) {
    const current = Number(row.quantity) || 1;

    if (delta > 0 && plateCount >= MAX_PLATES) {
      setError("A lunch request can include up to 20 plates in total.");
      return;
    }

    const next = Math.min(MAX_PLATES, Math.max(1, current + delta));
    updateMeal(row.id, { quantity: String(next) });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!hasSession) {
      setError("Sign in to send a request to cooks.");
      return;
    }

    const meals = rows.map((row) => ({
      name: row.name.trim(),
      quantity: Number(row.quantity),
    }));

    const mealsError = validateMealRequestLines(meals);

    if (mealsError) {
      setError(mealsError);
      return;
    }

    if (!pickupHub || !pickupDate || !pickupTime) {
      setError("Choose your pickup hub, date and time.");
      return;
    }

    if (pickupDate < getEarliestPickupDate()) {
      setError("That pickup date is no longer available. Choose a later date.");
      return;
    }

    const budget = Number(budgetPerPlate);

    if (
      !/^\d+(?:\.\d{1,2})?$/.test(budgetPerPlate.trim()) ||
      !Number.isFinite(budget) ||
      budget <= 0 ||
      budget > 99_999_999.99
    ) {
      setError("Enter a budget per plate in USD, such as 2.50.");
      return;
    }

    const items = mergeDuplicateMealRequestLines(meals);

    const payload = {
      items,
      budget,
      hub: pickupHub,
      pickup_date: pickupDate,
      pickup_time: pickupTime,
    };

    const fingerprint = JSON.stringify(payload);
    const idempotencyKey = getOrCreateIdempotencyKey(fingerprint);

    setSubmitting(true);

    try {
      const response = await fetch("/api/meal-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "We could not send your request. Please try again.";

        throw new Error(message);
      }

      if (
        !isRecord(result) ||
        !isSavedRequest(result.request)
      ) {
        throw new Error(
          "Your request response could not be verified. Check My Lunch before sending it again.",
        );
      }

      setSavedRequest(result.request);
      fallbackSubmission = null;

      clearMealHandoff();
      clearCustomerRequestDraft();

      try {
        window.sessionStorage.removeItem(SUBMISSION_STORAGE_KEY);
      } catch {
        // Optional cleanup.
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not send your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startAnotherRequest() {
    setSavedRequest(null);
    setRows([]);
    setPickupHub("");
    setPickupDate(getEarliestPickupDate());
    setPickupTime("12:00");
    setMealDraft(null);
    router.push("/dashboard");
  }

  const plateCount = getMealRequestPlateCount(
    rows
      .filter((row) => row.name.trim())
      .map((row) => ({
        name: row.name,
        quantity: Number(row.quantity) || 0,
      })),
  );

  const firstMeal = rows.find((row) => row.name.trim());
  const atPlateLimit = rows.length >= MAX_PLATES || plateCount >= MAX_PLATES;

  return (
    <main className="min-h-screen bg-cream-50 text-ink-900">
      <style>{requestStyles}</style>
      <CustomerNavigation />

      <div className="rq-shell">
        {!draftReady || authLoading ? (
          <div
            className="mx-auto max-w-5xl px-5 py-12 text-sm text-ink-900/60"
            role="status"
          >
            Preparing your lunch request…
          </div>
        ) : savedRequest ? (
          <RequestConfirmation
            request={savedRequest}
            onStartAnother={startAnotherRequest}
          />
        ) : !mealDraft ? (
          <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
            <Card className="p-6 text-center shadow-none sm:p-9">
              <h1 className="font-display text-3xl text-ink-900">
                Start with Ziva
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink-900/65">
                Tell Ziva what meal you have in mind. She will help prepare it
                before you add plate counts and pickup details.
              </p>
              <Button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="mt-5 min-h-11"
              >
                Describe your meal
              </Button>
            </Card>
          </section>
        ) : !hasSession ? (
          <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
            <Card className="p-6 text-center shadow-none sm:p-9">
              <h1 className="font-display text-3xl text-ink-900">
                Sign in to continue
              </h1>
              <p className="mt-3 text-sm leading-6 text-ink-900/65">
                Your meal is still saved on this device. Sign in before sending
                a request to cooks.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-clay-500 px-5 text-sm font-semibold text-white"
              >
                Sign in
              </Link>
            </Card>
          </section>
        ) : (
          <div className="rq-wrap">
            <div className="rq-grid">
              <section className="rq-main">
                <Link href="/dashboard" className="rq-back">
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Back to Ziva
                </Link>

                <div>
                  <p className="rq-tag">Plan your lunch</p>
                </div>

                <h1 className="rq-h1 font-display text-ink-900">
                  Check the meal
                  <span className="block text-clay-500">
                    and pickup details.
                  </span>
                </h1>
                <span aria-hidden="true" className="rq-rule" />

                <p className="rq-lead">
                  Ziva understood: “{mealDraft.description}” Add the number of
                  plates for each meal. You can change these details before
                  sending. Nothing is sent until you press the button.
                </p>

                <form
                  onSubmit={(event) => void handleSubmit(event)}
                  className="rq-form"
                >
                  {/* 1. Hub */}
                  <fieldset className="rq-fs">
                    <legend className="rq-step-title font-display">
                      <span className="rq-num" aria-hidden="true">1</span>
                      Pickup hub
                    </legend>

                    <div className="rq-hubs">
                      {HUBS.map((hub) => (
                        <label
                          key={hub}
                          className={`rq-hub${pickupHub === hub ? " is-on" : ""}`}
                        >
                          <input
                            type="radio"
                            name="pickup-hub"
                            value={hub}
                            checked={pickupHub === hub}
                            onChange={() => setPickupHub(hub)}
                            required
                          />
                          <MapPin
                            aria-hidden="true"
                            className="size-4 shrink-0 text-clay-500"
                          />
                          {hub}
                        </label>
                      ))}
                    </div>

                    <p className="rq-help">
                      Exact collection points will be confirmed before launch.
                    </p>
                  </fieldset>

                  {/* 2 + 3. Date and time */}
                  <div className="rq-two">
                    <div style={{ minWidth: 0 }}>
                      <label htmlFor="pickup-date" className="rq-label font-display">
                        <span className="rq-num" aria-hidden="true">2</span>
                        Pickup date
                      </label>
                      <input
                        id="pickup-date"
                        type="date"
                        min={getEarliestPickupDate()}
                        value={pickupDate}
                        onChange={(event) => setPickupDate(event.target.value)}
                        required
                        className="rq-input"
                      />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <label htmlFor="pickup-time" className="rq-label font-display">
                        <span className="rq-num" aria-hidden="true">3</span>
                        Pickup time
                      </label>
                      <input
                        id="pickup-time"
                        type="time"
                        min="08:00"
                        max="23:59"
                        value={pickupTime}
                        onChange={(event) => setPickupTime(event.target.value)}
                        required
                        className="rq-input"
                      />
                      <p className="rq-help">
                        Choose the time you plan to collect.
                      </p>
                    </div>
                  </div>

                  {/* 4. Meals */}
                  <fieldset className="rq-fs">
                    <legend className="rq-step-title font-display">
                      <span className="rq-num" aria-hidden="true">4</span>
                      Your meals and plate counts
                    </legend>

                    <p className="rq-help">
                      Give each meal its own count. Your request can include up
                      to 20 plates in total.
                    </p>

                    <div className="rq-meals">
                      {rows.map((row, index) => (
                        <div key={row.id} className="rq-meal">
                          <div style={{ minWidth: 0 }}>
                            <label
                              htmlFor={`meal-name-${row.id}`}
                              className="rq-mini"
                            >
                              Meal {index + 1}
                            </label>
                            <input
                              id={`meal-name-${row.id}`}
                              type="text"
                              value={row.name}
                              onChange={(event) =>
                                updateMeal(row.id, { name: event.target.value })
                              }
                              maxLength={150}
                              placeholder="e.g. Sadza, beef and vegetables"
                              required
                              className="rq-input"
                            />
                          </div>

                          <div className="rq-meal-foot">
                            <div>
                              <span className="rq-mini" id={`plates-${row.id}`}>
                                Plates
                              </span>
                              <div
                                className="rq-stepper"
                                role="group"
                                aria-labelledby={`plates-${row.id}`}
                                style={{ marginTop: 6 }}
                              >
                                <button
                                  type="button"
                                  className="rq-round"
                                  aria-label={`Fewer plates for meal ${index + 1}`}
                                  onClick={() => changePlates(row, -1)}
                                  disabled={(Number(row.quantity) || 1) <= 1}
                                >
                                  <Minus aria-hidden="true" className="size-4" />
                                </button>
                                <output aria-live="polite">
                                  {Number(row.quantity) || 1}
                                </output>
                                <button
                                  type="button"
                                  className="rq-round is-solid"
                                  aria-label={`More plates for meal ${index + 1}`}
                                  onClick={() => changePlates(row, 1)}
                                  disabled={plateCount >= MAX_PLATES}
                                >
                                  <Plus aria-hidden="true" className="size-4" />
                                </button>
                              </div>
                            </div>

                            {rows.length > 1 && (
                              <button
                                type="button"
                                className="rq-remove"
                                onClick={() =>
                                  persistRows(
                                    rows.filter((item) => item.id !== row.id),
                                  )
                                }
                                aria-label={`Remove meal ${index + 1}`}
                              >
                                <Trash2 aria-hidden="true" className="size-4" />
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rq-addrow">
                      <button
                        type="button"
                        className="rq-ghost"
                        onClick={() => addMeal()}
                        disabled={atPlateLimit}
                      >
                        <Plus aria-hidden="true" className="size-4" />
                        Add another meal
                      </button>

                      <p className="text-sm font-semibold text-ink-900">
                        Total plates: {plateCount}
                      </p>
                    </div>

                    <div
                      className="rq-chips"
                      role="group"
                      aria-label="Quick meal choices"
                    >
                      {QUICK_MEALS.map((meal) => (
                        <button
                          key={meal}
                          type="button"
                          className="rq-chip"
                          onClick={() => addMeal(meal)}
                          disabled={atPlateLimit}
                        >
                          + {meal}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {/* 5. Budget */}
                  <div>
                    <label htmlFor="budget-per-plate" className="rq-label font-display">
                      <span className="rq-num" aria-hidden="true">5</span>
                      Budget per plate (USD)
                    </label>

                    <div className="rq-money">
                      <span aria-hidden="true">$</span>
                      <input
                        id="budget-per-plate"
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        max="99999999.99"
                        step="0.01"
                        value={budgetPerPlate}
                        onChange={(event) =>
                          setBudgetPerPlate(event.target.value)
                        }
                        placeholder="2.50"
                        required
                        className="rq-input"
                      />
                    </div>

                    <p className="rq-help">
                      This is a guide for cooks. They choose their own prices.
                    </p>
                  </div>

                  {error && (
                    <p role="alert" className="rq-error">
                      {error}
                    </p>
                  )}

                  <div className="rq-foot">
                    <button
                      type="submit"
                      disabled={submitting}
                      aria-busy={submitting}
                      className="rq-send"
                    >
                      {submitting
                        ? "Sending your request…"
                        : "Send request to cooks"}
                      {!submitting && (
                        <ArrowRight aria-hidden="true" className="size-4" />
                      )}
                    </button>

                    <p className="rq-note">
                      Cooks will send offers. You choose one after checking the
                      meal and full price. No payment is made now. Pay your cook
                      in cash when you collect.
                    </p>
                  </div>
                </form>
              </section>

              <aside className="rq-aside" aria-label="About your request">
                <FeaturedMeal
                  mealName={firstMeal?.name.trim() ?? ""}
                  plates={Number(firstMeal?.quantity) || 1}
                  hub={pickupHub}
                  budget={budgetPerPlate}
                />

                <section className="rq-next" aria-labelledby="rq-next-heading">
                  <h2
                    id="rq-next-heading"
                    className="font-display text-xl text-ink-900"
                  >
                    What happens next
                  </h2>
                  <ul>
                    <li>Local cooks send you their own priced offers.</li>
                    <li>You compare them and choose, or decline them all.</li>
                    <li>Collect at your hub and pay cash.</li>
                  </ul>
                  <p
                    className="mt-4 font-display text-lg italic text-clay-500"
                    style={{ margin: "16px 0 0" }}
                  >
                    Eat Local. Enjoy Harare.
                  </p>
                </section>

                <section className="rq-ziva">
                  <div className="rq-ziva-dot font-display" aria-hidden="true">
                    Z
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p className="text-sm font-semibold text-ink-900">
                      Want to change the meal?
                    </p>
                    <Link href="/dashboard">
                      Tell Ziva what you’re craving →
                    </Link>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function FeaturedMeal({
  mealName,
  plates,
  hub,
  budget,
}: {
  mealName: string;
  plates: number;
  hub: PickupHub | "";
  budget: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = mealName ? pickMealImage(mealName) : null;
  const showImage = Boolean(src) && failedSrc !== src;
  const budgetNumber = Number(budget);
  const details = [
    hub ? `Pickup at ${hub}` : "Choose a pickup hub",
    `${plates} ${plates === 1 ? "plate" : "plates"}`,
    Number.isFinite(budgetNumber) && budgetNumber > 0
      ? `budget $${budgetNumber.toFixed(2)} per plate`
      : null,
  ].filter(Boolean);

  return (
    <section className="rq-feature" aria-label="Your meal">
      <div className="rq-feature-img">
        {showImage && src && (
          <Image
            src={src}
            alt=""
            fill
            loading="lazy"
            sizes="(min-width: 1280px) 20rem, 45vw"
            className="object-cover"
            onError={() => setFailedSrc(src)}
          />
        )}
      </div>
      <div className="rq-feature-body">
        <h2
          className="font-display text-2xl text-ink-900"
          style={{ overflowWrap: "anywhere" }}
        >
          {mealName || "Your meal"}
        </h2>
        <p className="mt-1.5 text-sm leading-5 text-ink-900/70">
          {details.join(" · ")}
        </p>
        {showImage && (
          <p className="mt-2.5 text-xs text-ink-900/55">
            Illustrative photo. It updates as you change your request.
          </p>
        )}
      </div>
    </section>
  );
}

function RequestConfirmation({
  request,
  onStartAnother,
}: {
  request: SavedRequest;
  onStartAnother: () => void;
}) {
  return (
    <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="rounded-xl border border-ink-900/10 bg-white p-6 sm:p-10">
        <p className="text-sm font-semibold text-sage-700">
          Request saved
        </p>

        <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
          Your meal request is on its way.
        </h1>

        <p className="mt-3 text-sm leading-6 text-ink-900/65">
          Approved cooks can now review it and prepare offers for you.
        </p>

        <dl className="mt-6 space-y-4 border-y border-ink-900/10 py-5 text-sm">
          <div>
            <dt className="text-xs text-ink-900/55">
              Request reference
            </dt>
            <dd className="mt-1 break-all font-mono text-ink-900">
              {request.id}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-ink-900/55">
              Meals and plates
            </dt>
            <dd className="mt-1 space-y-1 font-semibold text-ink-900">
              {request.items.map((item, index) => (
                <span
                  key={`${item.name}-${index}`}
                  className="block"
                >
                  {item.quantity} × {item.name}
                </span>
              ))}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-ink-900/55">
              Pickup hub
            </dt>
            <dd className="mt-1 font-semibold text-ink-900">
              {request.hub}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-ink-900/55">
              Pickup date and time
            </dt>
            <dd className="mt-1 font-semibold text-ink-900">
              {formatPickupDate(request.pickup_date)} at{" "}
              {request.pickup_time.slice(0, 5)}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-ink-900/55">
              Offer deadline
            </dt>
            <dd className="mt-1 font-semibold text-ink-900">
              {formatDeadline(request.offers_close_at)}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-sm leading-6 text-ink-900/65">
          No payment has been made. Choose whether to accept an offer after
          reviewing its meal and price. Pay your cook in cash when you collect.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button
            type="button"
            onClick={onStartAnother}
            className="min-h-11"
          >
            Make another request
          </Button>

          <Link
            href="/my-requests"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-clay-700 underline underline-offset-4"
          >
            Go to My Lunch
          </Link>
        </div>
      </div>
    </section>
  );
}