
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  parseMealRequest,
  ParseOrderApiError,
  type ParsedMealRequest,
} from "@/lib/parse-order-client";
import { createClient } from "@/lib/supabase/client";

const examples = [
  "I want two plates of sadza with beef and vegetables.",
  "Ndinoda sadza nemuriwo nenyama.",
  "Can I get one chicken and rice for lunch?",
];

const VALID_HUBS = ["Eastgate", "Joina City", "Avondale"] as const;

const SUBMISSION_STORAGE_KEY = "stewrun:meal-request-submission";

type PickupHub = (typeof VALID_HUBS)[number];

type RequestState = "editing" | "review";

interface SavedMealRequest {
  id: string;
  items: Array<{
    name: string;
    quantity: number;
  }>;
  hub: PickupHub;
  pickup_date: string;
  pickup_time: string;
  status: "open";
  offers_close_at: string;
}

interface StoredSubmission {
  key: string;
  fingerprint: string;
}

interface SubmissionPayload {
  items: ParsedMealRequest["items"];
  hub: PickupHub;
  pickup_date: string;
  pickup_time: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isPickupHub(value: unknown): value is PickupHub {
  return (
    typeof value === "string" &&
    VALID_HUBS.some((hub) => hub === value)
  );
}

function isValidSubmissionKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function readStoredSubmission(): StoredSubmission | null {
  try {
    const storedValue = window.sessionStorage.getItem(
      SUBMISSION_STORAGE_KEY,
    );

    if (!storedValue) {
      return null;
    }

    const parsed: unknown = JSON.parse(storedValue);

    if (
      !isRecord(parsed) ||
      !isValidSubmissionKey(parsed.key) ||
      typeof parsed.fingerprint !== "string"
    ) {
      return null;
    }

    return {
      key: parsed.key,
      fingerprint: parsed.fingerprint,
    };
  } catch {
    // Storage may be unavailable or contain invalid data.
    return null;
  }
}

function storeSubmission(value: StoredSubmission): void {
  try {
    window.sessionStorage.setItem(
      SUBMISSION_STORAGE_KEY,
      JSON.stringify(value),
    );
  } catch {
    // The in-memory state still protects retries during this page session.
  }
}

function clearStoredSubmission(): void {
  try {
    window.sessionStorage.removeItem(SUBMISSION_STORAGE_KEY);
  } catch {
    // Failure to clear storage must not prevent a new request.
  }
}

function getSubmissionFingerprint(
  payload: SubmissionPayload,
): string {
  // Property order is deliberately fixed so the same payload produces
  // the same fingerprint when reconstructed after a page refresh.
  return JSON.stringify({
    items: payload.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
    })),
    hub: payload.hub,
    pickup_date: payload.pickup_date,
    pickup_time: payload.pickup_time,
  });
}

function isValidSavedMealRequest(
  value: unknown,
): value is SavedMealRequest {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.id !== "string" ||
    !value.id.trim() ||
    !Array.isArray(value.items) ||
    value.items.length === 0 ||
    value.items.length > 20 ||
    !isPickupHub(value.hub) ||
    typeof value.pickup_date !== "string" ||
    !isValidDate(value.pickup_date) ||
    typeof value.pickup_time !== "string" ||
    !/^(0[8-9]|1\d|2[0-3]):[0-5]\d$/.test(value.pickup_time) ||
    value.status !== "open" ||
    typeof value.offers_close_at !== "string" ||
    Number.isNaN(Date.parse(value.offers_close_at))
  ) {
    return false;
  }

  return value.items.every(
    (item) =>
      isRecord(item) &&
      typeof item.name === "string" &&
      item.name.trim().length >= 2 &&
      item.name.trim().length <= 150 &&
      typeof item.quantity === "number" &&
      Number.isInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= 20,
  );
}

function getHarareParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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

function getEarliestPickupDate(): string {
  const parts = getHarareParts();

  let year = parts.year;
  let month = parts.month;
  let day = parts.day;

  // Same-day requests are unavailable from 10:00 AM onward.
  if (parts.hour >= 10) {
    const tomorrow = new Date(
      Date.UTC(year, month - 1, day + 1),
    );

    year = tomorrow.getUTCFullYear();
    month = tomorrow.getUTCMonth() + 1;
    day = tomorrow.getUTCDate();
  }

  return [
    year,
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function isAfterHarareCutoff(): boolean {
  return getHarareParts().hour >= 10;
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const [request, setRequest] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestRequiresSignIn, setRequestRequiresSignIn] =
    useState(false);

  const [parsing, setParsing] = useState(false);
  const [parsedRequest, setParsedRequest] =
    useState<ParsedMealRequest | null>(null);
  const [requestState, setRequestState] =
    useState<RequestState>("editing");

  const [pickupDate, setPickupDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedRequest, setSavedRequest] =
    useState<SavedMealRequest | null>(null);

  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [submissionFingerprint, setSubmissionFingerprint] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) {
          setUserEmail(session?.user.email ?? null);
          setAuthLoading(false);
          setAuthError(null);
        }
      },
    );

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;

        if (error) {
          setAuthError("We could not check your account right now.");
        } else {
          setUserEmail(data.session?.user.email ?? null);
        }

        setAuthLoading(false);
      })
      .catch(() => {
        if (active) {
          setAuthError("We could not check your account right now.");
          setAuthLoading(false);
        }
      });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    setSigningOut(true);
    setAuthError(null);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setAuthError("We could not sign you out. Please try again.");
      }
    } catch {
      setAuthError("We could not sign you out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedRequest = request.trim();

    setRequestError(null);
    setRequestRequiresSignIn(false);
    setParsedRequest(null);
    setPickupDate("");
    setSavedRequest(null);
    setSaveError(null);

    if (!trimmedRequest) {
      setRequestError(
        "Describe the meal you would like before continuing.",
      );
      return;
    }

    setParsing(true);

    try {
      const result = await parseMealRequest(trimmedRequest);

      setParsedRequest(result);
      setRequestState("review");
    } catch (error) {
      setRequestRequiresSignIn(
        error instanceof ParseOrderApiError && error.status === 401,
      );

      setRequestError(
        error instanceof ParseOrderApiError
          ? error.message
          : "We could not interpret your request. Please try again.",
      );
    } finally {
      setParsing(false);
    }
  }

  async function handleSaveRequest() {
    if (!parsedRequest || !pickupDate || saving) {
      return;
    }

    // Recheck the Harare cutoff at the moment of submission.
    // The date shown in the picker may have become stale if the
    // customer left this screen open across 10:00 AM.
    const earliestPickupDate = getEarliestPickupDate();

    if (!isValidDate(pickupDate) || pickupDate < earliestPickupDate) {
      setPickupDate("");
      setSaveError(
        "The pickup date is no longer available. Please choose a new date.",
      );
      return;
    }

    const payload: SubmissionPayload = {
      items: parsedRequest.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
      })),
      hub: parsedRequest.hub,
      pickup_date: pickupDate,
      pickup_time: parsedRequest.pickup_time,
    };

    const fingerprint = getSubmissionFingerprint(payload);

    // Reuse the current key when this exact request is retried.
    let key =
      submissionKey && submissionFingerprint === fingerprint
        ? submissionKey
        : null;

    // If the page was refreshed, recover the key from session storage.
    if (!key) {
      const storedSubmission = readStoredSubmission();

      if (storedSubmission?.fingerprint === fingerprint) {
        key = storedSubmission.key;
      }
    }

    // A changed payload receives a new key.
    if (!key) {
      key = crypto.randomUUID();
    }

    setSubmissionKey(key);
    setSubmissionFingerprint(fingerprint);

    storeSubmission({
      key,
      fingerprint,
    });

    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/meal-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify(payload),
      });

      let responsePayload: unknown;

      try {
        responsePayload = await response.json();
      } catch {
        throw new Error(
          "We received an unreadable response. Please try again.",
        );
      }

      if (!response.ok) {
        const message =
          isRecord(responsePayload) &&
          typeof responsePayload.error === "string"
            ? responsePayload.error
            : "We could not save your meal request.";

        throw new Error(message);
      }

      if (
        !isRecord(responsePayload) ||
        !isValidSavedMealRequest(responsePayload.request)
      ) {
        throw new Error(
          "The saved request could not be verified. Please retry this submission or check your requests before starting another one.",
        );
      }

      setSavedRequest(responsePayload.request);

      // The request is confirmed. The key is no longer needed.
      clearStoredSubmission();
      setSubmissionKey(null);
      setSubmissionFingerprint(null);
    } catch (error) {
      // Keep the key so a retry uses the same database identity.
      setSaveError(
        error instanceof Error
          ? error.message
          : "We could not save your meal request. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function editRequest() {
    setRequestState("editing");
    setRequestError(null);
    setSaveError(null);
  }

  function startAnotherRequest() {
    setRequest("");
    setParsedRequest(null);
    setPickupDate("");
    setSavedRequest(null);
    setSaveError(null);
    setRequestError(null);
    setRequestRequiresSignIn(false);
    setSubmissionKey(null);
    setSubmissionFingerprint(null);
    clearStoredSubmission();
    setRequestState("editing");
  }

  return (
    <main className="min-h-screen bg-cream-50">
      <header className="border-b border-ink-900/10 bg-cream-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a
            href="#home"
            className="inline-flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
            aria-label="StewRun home"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-clay-500 font-display text-xl font-semibold text-cream-50">
              S
            </span>

            <span className="font-display text-xl font-semibold tracking-tight text-ink-900">
              StewRun
            </span>
          </a>

          <nav aria-label="Account" className="flex items-center gap-3">
            {authLoading ? (
              <span className="text-sm text-ink-900/60" role="status">
                Checking account...
              </span>
            ) : userEmail ? (
              <>
                <span className="hidden max-w-48 truncate text-sm text-ink-900/70 sm:inline">
                  {userEmail}
                </span>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="min-h-10 rounded-lg border border-ink-900/20 px-3 text-sm font-medium text-ink-900 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 disabled:opacity-60"
                >
                  {signingOut ? "Signing out..." : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded px-2 py-2 text-sm font-semibold text-ink-900 hover:text-clay-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                >
                  Sign in
                </Link>

                <Link
                  href="/register"
                  className="inline-flex min-h-10 items-center rounded-lg bg-clay-500 px-4 text-sm font-semibold text-cream-50 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                >
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section
        id="home"
        className="mx-auto max-w-7xl px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-16"
      >
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_0.92fr] lg:gap-16">
          <div className="order-2 pt-2 lg:order-1">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
              Harare lunches, made at home
            </p>

            <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
              A good lunch is just around the corner.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-ink-900/70 sm:text-lg sm:leading-8">
              Tell us what you feel like eating in English or Shona. We&apos;ll
              organise your request for pickup at a convenient Harare hub.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-900/70">
              <span className="inline-flex items-center gap-2">
                <span
                  className="size-2 rounded-full bg-sage-500"
                  aria-hidden="true"
                />
                Home-cooked meals
              </span>

              <span className="inline-flex items-center gap-2">
                <span
                  className="size-2 rounded-full bg-saffron-500"
                  aria-hidden="true"
                />
                Easy hub pickup
              </span>
            </div>

            <section
              aria-labelledby="how-it-works"
              className="mt-12 border-t border-ink-900/10 pt-6"
            >
              <h2
                id="how-it-works"
                className="font-display text-xl font-semibold text-ink-900"
              >
                How it works
              </h2>

              <ol className="mt-5 grid gap-4 sm:grid-cols-3">
                {[
                  [
                    "01",
                    "Describe your meal",
                    "Write it naturally in English or Shona.",
                  ],
                  [
                    "02",
                    "Review the details",
                    "Check the meal, pickup hub, date and time.",
                  ],
                  [
                    "03",
                    "Receive cook offers",
                    "Review available offers before placing an order.",
                  ],
                ].map(([number, title, description]) => (
                  <li key={number} className="flex gap-3">
                    <span className="font-mono text-xs font-medium text-clay-500">
                      {number}
                    </span>

                    <div>
                      <h3 className="text-sm font-semibold text-ink-900">
                        {title}
                      </h3>

                      <p className="mt-1 text-sm leading-5 text-ink-900/65">
                        {description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <Card className="order-1 border border-ink-900/8 p-5 shadow-[0_12px_40px_rgba(31,27,22,0.06)] sm:p-7 lg:order-2">
            {savedRequest ? (
              <SuccessPanel
                request={savedRequest}
                onStartAnother={startAnotherRequest}
              />
            ) : requestState === "editing" || !parsedRequest ? (
              <>
                <div className="mb-6">
                  <p className="text-sm font-semibold text-clay-500">
                    Start with a craving
                  </p>

                  <h2 className="mt-2 font-display text-2xl tracking-tight text-ink-900 sm:text-3xl">
                    What would you like for lunch?
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-ink-900/65">
                    Share the dishes and quantities you have in mind. You can
                    review the interpretation before submitting anything.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="meal-request"
                      className="mb-2 block text-sm font-medium text-ink-900"
                    >
                      Your meal request
                    </label>

                    <textarea
                      id="meal-request"
                      name="meal-request"
                      rows={5}
                      maxLength={500}
                      value={request}
                      onChange={(event) => {
                        setRequest(event.target.value);
                        setRequestError(null);
                        setRequestRequiresSignIn(false);
                      }}
                      placeholder="For example: I want two plates of sadza with beef and vegetables."
                      aria-describedby="request-help request-count"
                      aria-invalid={Boolean(requestError)}
                      className="w-full resize-y rounded-xl border border-ink-900/20 bg-white px-4 py-3 text-base leading-6 text-ink-900 placeholder:text-ink-900/45 focus:border-clay-500 focus:outline-none focus:ring-2 focus:ring-clay-500/25"
                    />

                    <div className="mt-2 flex justify-between gap-3 text-xs leading-5 text-ink-900/60">
                      <span id="request-help">
                        English or Shona, whichever feels natural.
                      </span>

                      <span id="request-count" className="shrink-0">
                        {request.length}/500
                      </span>
                    </div>
                  </div>

                  <fieldset>
                    <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-900/60">
                      Try an example
                    </legend>

                    <div className="flex flex-wrap gap-2">
                      {examples.map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => {
                            setRequest(example);
                            setRequestError(null);
                            setRequestRequiresSignIn(false);
                          }}
                          className="rounded-full border border-ink-900/15 bg-cream-50 px-3 py-2 text-left text-xs leading-4 text-ink-900/80 hover:border-sage-500 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-500"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {requestError && (
                    <div
                      role="alert"
                      className="rounded-lg border border-clay-500/25 bg-clay-500/5 px-4 py-3 text-sm leading-5 text-ink-900"
                    >
                      <p>{requestError}</p>

                      {requestRequiresSignIn && (
                        <Link
                          href="/login"
                          className="mt-1 inline-block font-semibold text-clay-500 underline-offset-4 hover:underline"
                        >
                          Sign in to continue
                        </Link>
                      )}
                    </div>
                  )}

                  {authError && (
                    <p role="status" className="text-sm text-clay-500">
                      {authError}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={parsing}
                    aria-busy={parsing}
                    className="min-h-12 w-full rounded-lg text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {parsing
                      ? "Understanding your request..."
                      : "Review meal request"}
                  </Button>

                  <p className="text-center text-xs leading-5 text-ink-900/60">
                    This step only interprets your request. It does not save or
                    place an order.
                  </p>
                </form>
              </>
            ) : (
              <ReviewPanel
                result={parsedRequest}
                pickupDate={pickupDate}
                minPickupDate={getEarliestPickupDate()}
                afterCutoff={isAfterHarareCutoff()}
                saving={saving}
                saveError={saveError}
                onPickupDateChange={(date) => {
                  setPickupDate(date);
                  setSaveError(null);
                }}
                onSave={handleSaveRequest}
                onEdit={editRequest}
              />
            )}
          </Card>
        </div>
      </section>

      <section
        aria-labelledby="pickup-hubs"
        className="border-y border-ink-900/10 bg-white/55"
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-9 sm:px-8 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
              Close to your day
            </p>

            <h2
              id="pickup-hubs"
              className="mt-2 font-display text-2xl tracking-tight text-ink-900"
            >
              Choose a Harare pickup hub
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {["Eastgate", "Joina City", "Avondale"].map((hub) => (
              <div
                key={hub}
                className="rounded-xl border border-ink-900/10 bg-cream-50 px-4 py-3"
              >
                <p className="text-sm font-semibold text-ink-900">{hub}</p>
                <p className="mt-1 text-xs text-ink-900/60">
                  Pickup available
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-sm text-ink-900/60 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>Made for a better lunch break in Harare.</p>
        <p>Place pre-orders before 10:00 AM each day.</p>
      </footer>
    </main>
  );
}

function ReviewPanel({
  result,
  pickupDate,
  minPickupDate,
  afterCutoff,
  saving,
  saveError,
  onPickupDateChange,
  onSave,
  onEdit,
}: {
  result: ParsedMealRequest;
  pickupDate: string;
  minPickupDate: string;
  afterCutoff: boolean;
  saving: boolean;
  saveError: string | null;
  onPickupDateChange: (date: string) => void;
  onSave: () => void;
  onEdit: () => void;
}) {
  return (
    <section aria-labelledby="review-heading" aria-live="polite">
      <p className="text-sm font-semibold text-sage-500">
        Request interpreted
      </p>

      <h2
        id="review-heading"
        className="mt-2 font-display text-2xl tracking-tight text-ink-900 sm:text-3xl"
      >
        Review your meal
      </h2>

      <p className="mt-2 text-sm leading-6 text-ink-900/65">
        Check that these details match what you meant before submitting.
      </p>

      {result.confidence === "low" && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-saffron-500/50 bg-saffron-500/10 px-4 py-3 text-sm leading-5 text-ink-900"
        >
          We&apos;re not fully sure we understood. Please check the details
          carefully or edit your request.
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-900/60">
          Interpreted items
        </h3>

        <ul className="mt-3 divide-y divide-ink-900/10 border-y border-ink-900/10">
          {result.items.map((item, index) => (
            <li
              key={`${item.name}-${index}`}
              className="flex items-start justify-between gap-4 py-3"
            >
              <span className="font-medium text-ink-900">{item.name}</span>

              <span className="shrink-0 text-sm text-ink-900/70">
                Qty {item.quantity}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-cream-50 p-3">
          <dt className="text-xs font-medium text-ink-900/60">
            Pickup hub
          </dt>

          <dd className="mt-1 text-sm font-semibold text-ink-900">
            {result.hub}
          </dd>
        </div>

        <div className="rounded-lg bg-cream-50 p-3">
          <dt className="text-xs font-medium text-ink-900/60">
            Pickup time
          </dt>

          <dd className="mt-1 text-sm font-semibold text-ink-900">
            {result.pickup_time}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <label
          htmlFor="pickup-date"
          className="mb-2 block text-sm font-semibold text-ink-900"
        >
          Choose your pickup date
        </label>

        <input
          id="pickup-date"
          type="date"
          required
          min={minPickupDate}
          value={pickupDate}
          onChange={(event) => onPickupDateChange(event.target.value)}
          className="min-h-12 w-full rounded-lg border border-ink-900/20 bg-white px-3 py-2 text-ink-900 focus:border-clay-500 focus:outline-none focus:ring-2 focus:ring-clay-500/25"
        />

        <p className="mt-2 text-xs leading-5 text-ink-900/60">
          {afterCutoff
            ? "The 10:00 AM Harare cutoff has passed. Please choose tomorrow or a later date."
            : "You can choose today before 10:00 AM Harare time, or select a future date."}
        </p>
      </div>

      {result.notes.trim() && (
        <p className="mt-4 rounded-lg border border-ink-900/10 px-4 py-3 text-sm leading-5 text-ink-900/75">
          <span className="font-semibold text-ink-900">
            AI interpretation note:{" "}
          </span>
          {result.notes}
        </p>
      )}

      <div className="mt-5 rounded-lg bg-cream-50 p-3">
        <p className="text-xs font-medium text-ink-900/60">
          Offer submission deadline
        </p>

        <p className="mt-1 text-sm font-semibold text-ink-900">
          10:00 AM Harare time on your selected pickup date
        </p>
      </div>

      <p className="mt-4 text-sm leading-6 text-ink-900/65">
        Saving this request does not place an order or charge you. You&apos;ll
        review cook offers and prices before deciding whether to order.
      </p>

      {saveError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-clay-500/25 bg-clay-500/5 px-4 py-3 text-sm leading-5 text-ink-900"
        >
          {saveError}
        </p>
      )}

      <Button
        type="button"
        onClick={onSave}
        disabled={!pickupDate || pickupDate < minPickupDate || saving}
        aria-busy={saving}
        className="mt-5 min-h-12 w-full rounded-lg text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Submitting request..." : "Submit meal request"}
      </Button>

      <Button
        type="button"
        variant="secondary"
        onClick={onEdit}
        disabled={saving}
        className="mt-3 min-h-12 w-full rounded-lg text-base font-semibold"
      >
        Edit my request
      </Button>
    </section>
  );
}

function SuccessPanel({
  request,
  onStartAnother,
}: {
  request: SavedMealRequest;
  onStartAnother: () => void;
}) {
  return (
    <section aria-labelledby="success-heading" aria-live="polite">
      <p className="text-sm font-semibold text-sage-500">
        Request saved
      </p>

      <h2
        id="success-heading"
        className="mt-2 font-display text-2xl tracking-tight text-ink-900 sm:text-3xl"
      >
        Your meal request is on its way.
      </h2>

      <p className="mt-3 text-sm leading-6 text-ink-900/65">
        Your request has been saved. Approved cooks can now review it and
        prepare offers for you.
      </p>

      <div className="mt-6 space-y-4 rounded-xl bg-cream-50 p-4">
        <div>
          <p className="text-xs font-medium text-ink-900/60">
            Request reference
          </p>

          <p className="mt-1 break-all font-mono text-sm text-ink-900">
            {request.id}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-ink-900/60">
            Pickup hub
          </p>

          <p className="mt-1 text-sm font-semibold text-ink-900">
            {request.hub}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-ink-900/60">
            Pickup date and time
          </p>

          <p className="mt-1 text-sm font-semibold text-ink-900">
            {request.pickup_date} at {request.pickup_time}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-ink-900/60">
            Offer deadline
          </p>

          <p className="mt-1 text-sm font-semibold text-ink-900">
            {new Date(request.offers_close_at).toLocaleString("en-GB", {
              timeZone: "Africa/Harare",
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            Harare time
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-ink-900/65">
        No payment has been made. You will decide whether to accept an offer
        after reviewing its price and details.
      </p>

      <Button
        type="button"
        onClick={onStartAnother}
        className="mt-5 min-h-12 w-full rounded-lg text-base font-semibold"
      >
        Make another request
      </Button>
    </section>
  );
}
