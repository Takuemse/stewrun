"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Utensils } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ActivityPanel,
  DashAccount,
  DashboardStyles,
  NextPickupCard,
  PopularChoices,
  SafeImage,
  StatsPanel,
} from "@/components/dashboard-panels";
import {
  deriveActivity,
  deriveSummary,
  fetchActivityRequests,
  fetchCustomerName,
  type ActivityRequest,
} from "@/lib/customer-activity-client";
import { fetchCustomerOrders, type CustomerOrder } from "@/lib/orders-client";
import {
  parseMealRequest,
  ParseOrderApiError,
  type ParsedMealRequest,
} from "@/lib/parse-order-client";
import {
  clearParsedMealDraft,
  saveParsedMealDraft,
} from "@/lib/parsed-meal-draft";

const quickChips = [
  { label: "Sadza & beef", prompt: "I want sadza with beef stew." },
  { label: "Chicken & rice", prompt: "I want chicken and rice for lunch." },
  { label: "Vegetarian", prompt: "I would like sadza with muriwo and no meat." },
];

/* Hero photo: put a real cook photo here (with the cook's permission).
   If the file is missing, the hero simply shows its warm gradient. */
const HERO_PHOTO = "/images/local-cook.jpg";

type PartOfDay = "morning" | "midday" | "afternoon" | "evening" | "default";

const greetings: Record<PartOfDay, { eyebrow: string; line: string }> = {
  morning: { eyebrow: "Good morning", line: "what’s for lunch today?" },
  midday: { eyebrow: "Lunchtime", line: "ready for lunch?" },
  afternoon: { eyebrow: "Good afternoon", line: "ready for something delicious?" },
  evening: { eyebrow: "Good evening", line: "let’s plan tomorrow’s lunch." },
  default: { eyebrow: "Welcome back", line: "ready for lunch?" },
};

export default function CustomerDashboardPage() {
  const router = useRouter();
  const heroRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ziva request state (unchanged)
  const [description, setDescription] = useState("");
  const [parsedRequest, setParsedRequest] = useState<ParsedMealRequest | null>(null);
  const [clarifying, setClarifying] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);

  // Dashboard data (read-only, from existing endpoints)
  const [fullName, setFullName] = useState<string | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [requests, setRequests] = useState<ActivityRequest[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [ordersFailed, setOrdersFailed] = useState(false);
  const [requestsFailed, setRequestsFailed] = useState(false);
  const [loadedAt, setLoadedAt] = useState(0);
  const [partOfDay, setPartOfDay] = useState<PartOfDay>("default");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 11) setPartOfDay("morning");
      else if (hour >= 11 && hour < 14) setPartOfDay("midday");
      else if (hour >= 14 && hour < 18) setPartOfDay("afternoon");
      else setPartOfDay("evening");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let active = true;

    void Promise.allSettled([
      fetchCustomerOrders(),
      fetchActivityRequests(),
      fetchCustomerName(),
    ]).then(([ordersResult, requestsResult, nameResult]) => {
      if (!active) return;
      if (ordersResult.status === "fulfilled") setOrders(ordersResult.value);
      else setOrdersFailed(true);
      if (requestsResult.status === "fulfilled") setRequests(requestsResult.value);
      else setRequestsFailed(true);
      if (nameResult.status === "fulfilled") setFullName(nameResult.value);
      setLoadedAt(Date.now());
      setDataLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(
    () => deriveSummary(orders, requests, loadedAt),
    [orders, requests, loadedAt],
  );
  const activity = useMemo(
    () => deriveActivity(orders, requests, loadedAt),
    [orders, requests, loadedAt],
  );

  const firstName = fullName?.split(/\s+/)[0] ?? null;
  const copy = greetings[partOfDay];

  function continueToPlan(result: ParsedMealRequest, mealDescription: string) {
    saveParsedMealDraft({
      description: mealDescription,
      items: result.items.map((item) => ({ name: item.name, quantity: item.quantity })),
      hub: result.hub,
      pickupTime: result.pickup_time,
      budget: result.budget,
    });
    router.push("/start");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mealDescription = description.trim();
    setError("");
    setNeedsSignIn(false);
    if (!mealDescription) {
      setError("Tell Ziva what meal you would like first.");
      return;
    }

    clearParsedMealDraft();
    setParsing(true);
    try {
      const result = await parseMealRequest(mealDescription);
      setParsedRequest(result);
      if (result.clarification === "meat_type") {
        setClarifying(true);
        return;
      }
      continueToPlan(result, mealDescription);
    } catch (parseError) {
      setNeedsSignIn(parseError instanceof ParseOrderApiError && parseError.status === 401);
      setError(parseError instanceof Error ? parseError.message : "Ziva could not understand that. Please try again.");
    } finally {
      setParsing(false);
    }
  }

  async function handleMeatChoice(choice: string) {
    if (!parsedRequest || parsing) return;
    setParsing(true);
    setError("");
    try {
      const clarified = `${description.trim()}\nThe customer answered Ziva's meat question: ${choice}.`;
      const result = await parseMealRequest(clarified);
      setParsedRequest(result);
      if (result.clarification === "meat_type") {
        setError("Ziva still needs a meat choice. Please choose one below.");
        return;
      }
      continueToPlan(result, description.trim());
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Ziva could not update your meal. Please try again.");
    } finally {
      setParsing(false);
    }
  }

  function editDescription() {
    setClarifying(false);
    setParsedRequest(null);
    setError("");
    clearParsedMealDraft();
  }

  /** Fills the Ziva box and brings it into view. Nothing is sent. */
  function focusZiva(prompt?: string) {
    if (parsing) return;
    if (clarifying) editDescription();
    if (prompt) {
      setDescription(prompt);
      setError("");
      setNeedsSignIn(false);
    }
    window.setTimeout(() => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      heroRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
  }

  return (
    <main className="min-h-screen bg-cream-50">
      <DashboardStyles />

      <div className="dash-wrap">
        <DashAccount firstName={firstName} />

        <div className="dash-grid">
          <div className="dash-main">
            {/* Hero with the Ziva request */}
            <section
              ref={heroRef}
              aria-labelledby="dash-heading"
              className={`dash-hero${clarifying ? " is-wide" : ""}`}
            >
              <div className="dash-hero-photo" aria-hidden="true">
                <SafeImage
                  src={HERO_PHOTO}
                  sizes="(min-width: 768px) 40vw, 0px"
                  className="object-cover object-[60%_30%]"
                />
              </div>

              <div className="dash-hero-body">
                <p className="text-sm font-semibold text-clay-500">
                  {copy.eyebrow}
                </p>
                <h1
                  id="dash-heading"
                  className="mt-1 font-display text-3xl leading-[1.08] tracking-tight text-ink-900 sm:text-4xl lg:text-[44px]"
                  style={{ overflowWrap: "anywhere" }}
                >
                  {firstName ?? "Hello"},
                  <span className="block text-clay-500">{copy.line}</span>
                </h1>
                <span
                  aria-hidden="true"
                  className="mt-4 block h-1 w-[102px] rounded-full bg-saffron-500"
                />

                {clarifying ? (
                  <div className="dash-panel">
                    <MeatClarificationPanel
                      loading={parsing}
                      error={error}
                      onChoose={(choice) => void handleMeatChoice(choice)}
                      onBack={editDescription}
                    />
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="dash-form">
                    <div className="dash-pill">
                      <label htmlFor="ziva-request" className="sr-only">
                        Describe your meal
                      </label>
                      <input
                        id="ziva-request"
                        ref={inputRef}
                        type="text"
                        value={description}
                        onChange={(event) => {
                          setDescription(event.target.value);
                          setError("");
                          setNeedsSignIn(false);
                        }}
                        maxLength={500}
                        placeholder="Describe your meal to Ziva…"
                        className="dash-input"
                      />
                      <Button
                        type="submit"
                        disabled={parsing}
                        aria-busy={parsing}
                        className="dash-ask"
                      >
                        {parsing ? "Thinking…" : "Ask Ziva"}
                        {!parsing && (
                          <ArrowRight aria-hidden="true" className="size-4" />
                        )}
                      </Button>
                    </div>

                    <div className="dash-chips">
                      {quickChips.map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          className="dash-chip"
                          onClick={() => {
                            setDescription(chip.prompt);
                            setError("");
                            inputRef.current?.focus();
                          }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="rounded-lg border border-clay-500/25 bg-white px-4 py-3 text-sm text-ink-900"
                      >
                        <p>{error}</p>
                        {needsSignIn && (
                          <Link
                            href="/login"
                            className="mt-2 inline-block font-semibold text-clay-700 underline"
                          >
                            Sign in to continue
                          </Link>
                        )}
                      </div>
                    )}

                    <p className="text-xs leading-5 text-ink-900/65">
                      Nothing is sent to cooks until you review and submit it
                      on the next page.
                    </p>
                  </form>
                )}
              </div>
            </section>

            {summary.nextOrder && (
              <NextPickupCard
                order={summary.nextOrder}
                moreCount={summary.moreActive}
              />
            )}

            <PopularChoices onRequest={(prompt) => focusZiva(prompt)} />
          </div>

          <aside className="dash-side" aria-label="Your lunch summary">
            <StatsPanel
              loading={dataLoading}
              ordersFailed={ordersFailed}
              requestsFailed={requestsFailed}
              summary={summary}
            />

            <section className="dash-card" aria-labelledby="actions-heading">
              <h2 id="actions-heading" className="font-display text-xl text-ink-900">
                Quick actions
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="dash-btn dash-btn-solid"
                  onClick={() => focusZiva()}
                >
                  Start a lunch request
                </button>
                <Link href="/my-requests" className="dash-btn dash-btn-outline">
                  {summary.offersToReview > 0 && !dataLoading
                    ? `Review my offers (${summary.offersToReview})`
                    : "Open My Lunch"}
                </Link>
              </div>
            </section>

            <ActivityPanel items={activity} loading={dataLoading} />

            <section
              className="rounded-xl border border-sage-500/20 bg-white p-5"
              aria-labelledby="next-heading"
            >
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sage-700">
                <Utensils aria-hidden="true" className="size-4" /> What happens next
              </p>
              <h2
                id="next-heading"
                className="mt-3 font-display text-xl tracking-tight text-ink-900"
              >
                Check your meal, then compare.
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-900/70">
                You will add plate counts, pickup details and a per-plate
                budget. Cooks then send their own offers. Pay the cook in cash
                when you collect.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function MeatClarificationPanel({
  loading,
  error,
  onChoose,
  onBack,
}: {
  loading: boolean;
  error: string;
  onChoose: (choice: string) => void;
  onBack: () => void;
}) {
  const choices = [
    { value: "Beef (nyama yemombe)", label: "Beef", shona: "Nyama yemombe", icon: "🐄" },
    { value: "Chicken (huku)", label: "Chicken", shona: "Huku", icon: "🐔" },
    { value: "Any meat", label: "Any meat", shona: "Nyama chero ipi", icon: "🍖" },
  ];
  const [other, setOther] = useState("");

  return (
    <section aria-labelledby="ziva-meat-question">
      <p className="text-xs font-semibold uppercase tracking-wider text-clay-600">One quick question</p>
      <h2 id="ziva-meat-question" className="mt-2 font-display text-2xl text-ink-900">What kind of meat would you like?</h2>
      <p className="mt-2 text-sm leading-6 text-ink-900/65">Choose one, or tell Ziva another kind.</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {choices.map((choice) => <button key={choice.value} type="button" onClick={() => onChoose(choice.value)} disabled={loading} className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-ink-900/15 bg-white p-3 text-center hover:border-clay-500 hover:bg-clay-500/5 disabled:opacity-60"><span aria-hidden="true" className="text-3xl">{choice.icon}</span><span className="text-sm font-semibold">{choice.label}</span><span className="text-xs text-ink-900/60">{choice.shona}</span></button>)}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="other-meat">Other meat</label>
        <input id="other-meat" value={other} onChange={(event) => setOther(event.target.value)} maxLength={100} placeholder="Another meat, such as pork" className="min-h-11 flex-1 rounded-lg border border-ink-900/20 bg-white px-3 text-base" />
        <Button type="button" disabled={!other.trim() || loading} onClick={() => onChoose(`Other meat: ${other.trim()}`)} className="min-h-11">Use this</Button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-clay-600">{error}</p>}
      {loading && <p role="status" className="mt-3 text-sm text-ink-900/60">Ziva is updating your meal…</p>}
      <button type="button" onClick={onBack} disabled={loading} className="mt-5 min-h-10 text-sm font-medium text-ink-900/65 underline underline-offset-4">Change my description</button>
    </section>
  );
}