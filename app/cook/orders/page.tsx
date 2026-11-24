"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  PackageCheck,
  RefreshCw,
  Utensils,
} from "lucide-react";
import Link from "next/link";

import AccountMenu from "@/components/account-menu";
import CookShell, { cookAccountLinks } from "@/components/cook-shell";
import NotificationBell from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { checkLineTotalConsistency } from "@/lib/meal-line-pricing";
import {
  CookOrderApiError,
  fetchCookOrders,
  type CookOrder,
  type CookOrderStatus,
} from "@/lib/cook-orders-client";

type OrderStage = "confirmed" | "ready" | "completed";
type Transition = "ready" | "collect";

const stages: {
  id: OrderStage;
  label: string;
}[] = [
  { id: "confirmed", label: "Confirmed" },
  { id: "ready", label: "Ready for pickup" },
  { id: "completed", label: "Completed" },
];

function formatCurrency(amount: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount));
}

function formatPickupDate(value: string | null) {
  if (!value) return "Not available";

  const date = new Date(`${value}T00:00:00+02:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-ZW", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Harare",
  }).format(date);
}

function formatPickupTime(value: string | null) {
  if (!value) return "Not available";
  return value.slice(0, 5);
}

function getStageForStatus(status: CookOrderStatus): OrderStage {
  return status === "collected" ? "completed" : status;
}

function getStatusLabel(status: CookOrderStatus) {
  if (status === "ready") return "Ready for pickup";
  if (status === "collected") return "Completed";
  return "Confirmed";
}

function getStatusTone(status: CookOrderStatus) {
  if (status === "ready" || status === "collected") return "success";
  return "info";
}

function getLoadError(error: unknown) {
  if (error instanceof CookOrderApiError || error instanceof Error) {
    return error.message;
  }

  return "We could not load your orders. Please try again.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getActionError(payload: unknown) {
  if (isRecord(payload) && typeof payload.error === "string") {
    return payload.error;
  }

  return "We could not update this order. Please try again.";
}

/* Orders-specific layout, scoped so it does not depend on new Tailwind
   utilities. The shared cook shell and hero styles come from CookShell. */
const orderStyles = `
  .ord-tabs{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 8px;margin-top:22px}
  .ord-tab{flex:none;display:inline-flex;align-items:center;gap:10px;min-height:50px;
    padding:0 22px;border:0;border-radius:999px;background:#fff;font-size:15px;
    font-weight:600;color:#2A211C;cursor:pointer;box-shadow:0 2px 6px rgba(120,70,30,.08)}
  .ord-tab:focus-visible{outline:2px solid #B4472B;outline-offset:3px}
  .ord-tab[aria-pressed="true"]{background:#B4472B;color:#fff}
  .ord-tab b{display:inline-flex;align-items:center;justify-content:center;min-width:24px;
    height:24px;padding:0 6px;border-radius:999px;background:#F1E7D8;color:#2A211C;
    font-size:12px}
  .ord-tab[aria-pressed="true"] b{background:#E8A030}
  .ord-cols{display:grid;gap:22px;margin-top:18px}
  .ord-main{display:flex;flex-direction:column;gap:18px;min-width:0}
  .ord-side{display:flex;flex-direction:column;gap:18px;min-width:0}
  .ord-card{background:#fff;border-radius:24px;padding:20px;min-width:0;
    box-shadow:0 10px 28px rgba(120,70,30,.08)}
  .ord-card.is-ready{border:1.5px solid #E8A030}
  .ord-card.is-plain{box-shadow:none;border:1px solid rgba(42,33,28,.1)}
  .ord-row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
  .ord-grow{flex:1 1 240px;min-width:0}
  .ord-date{flex:none;width:64px;border-radius:16px;background:#FBE6CC;text-align:center;
    padding:8px 0;display:flex;flex-direction:column;line-height:1.1}
  .ord-date span{font-size:10.5px;font-weight:700;letter-spacing:.1em;color:#7A4A00}
  .ord-date b{font-size:26px;font-weight:500;color:#2A211C}
  .ord-date.is-small{width:54px}.ord-date.is-small b{font-size:21px}
  .ord-meal{display:grid;gap:16px;margin-top:16px;padding-top:16px;
    border-top:1px solid rgba(42,33,28,.1)}
  .ord-subtotal{border-top:1px solid rgba(42,33,28,.1);padding-top:12px}
  .ord-steps{position:relative;display:grid;grid-template-columns:repeat(3,1fr);
    list-style:none;margin:22px 0 4px;padding:0;text-align:center}
  .ord-steps::before{content:"";position:absolute;left:16.667%;right:16.667%;top:13px;
    border-top:2px solid #E7DACB}
  .ord-steps::after{content:"";position:absolute;left:16.667%;top:13px;
    border-top:2px solid #B4472B;width:calc(66.667% * var(--p,0))}
  .ord-dot{position:relative;z-index:1;width:26px;height:26px;margin:0 auto 6px;
    border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:#fff;border:2px solid #CFC2B4;color:#B4472B}
  .ord-dot.is-done{background:#B4472B;border-color:#B4472B;color:#fff}
  .ord-dot.is-current{border:3px solid #E8A030}
  .ord-step{font-size:12.5px;color:#6B5E55}
  .ord-step.is-on{font-weight:700;color:#2A211C}
  .ord-facts{display:grid;grid-template-columns:1fr;gap:12px;margin:18px 0 0;
    padding-top:16px;border-top:1px solid rgba(42,33,28,.1)}
  .ord-action{margin-top:18px;border-top:1px solid rgba(42,33,28,.1);padding-top:16px}
  .ord-code{background:#FAF5EF;border-radius:16px;padding:16px 18px}
  .ord-empty{text-align:center;border:1px dashed rgba(42,33,28,.18);border-radius:24px;
    padding:32px 20px;background:transparent}
  .ord-compact summary{cursor:pointer;min-height:44px;display:flex;align-items:center;
    font-size:13px;font-weight:600;color:#B4472B}
  .ord-compact summary:focus-visible{outline:2px solid #B4472B;outline-offset:2px}
  .ord-note{background:#FDF4E9;border-radius:24px;padding:20px}
  .ord-dark{background:#1F1915;color:#FFF7EF;border-radius:24px;padding:20px}
  @media (min-width:420px){.ord-facts{grid-template-columns:1fr 1fr}}
  @media (min-width:640px){
    .ord-card{padding:24px}
    .ord-meal{grid-template-columns:minmax(0,1fr) auto}
    .ord-subtotal{border-top:0;border-left:1px solid rgba(42,33,28,.12);padding:0 0 0 20px}
    .ord-facts{grid-template-columns:repeat(3,1fr)}
  }
  @media (min-width:1100px){
    .ord-cols{grid-template-columns:minmax(0,1fr) 320px;align-items:start}
  }
`;

function DateTile({
  date,
  small = false,
}: {
  date: string | null | undefined;
  small?: boolean;
}) {
  const parsed = date ? new Date(`${date}T12:00:00+02:00`) : null;
  const valid = parsed !== null && !Number.isNaN(parsed.getTime());
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Harare",
      ...options,
    }).format(parsed as Date);

  return (
    <div aria-hidden="true" className={`ord-date${small ? " is-small" : ""}`}>
      <span>{valid ? format({ weekday: "short" }).toUpperCase() : "DATE"}</span>
      <b className="font-display">{valid ? format({ day: "numeric" }) : "–"}</b>
      <span>{valid ? format({ month: "short" }).toUpperCase() : "TBC"}</span>
    </div>
  );
}

const progressSteps = ["Confirmed", "Ready", "Collected"] as const;

function OrderProgress({ status }: { status: CookOrderStatus }) {
  const current = status === "collected" ? 2 : status === "ready" ? 1 : 0;

  return (
    <ol
      className="ord-steps"
      aria-label="Order progress"
      style={{ "--p": current / 2 } as CSSProperties}
    >
      {progressSteps.map((label, index) => {
        const done = index < current || (status === "collected" && index === 2);
        const isCurrent = index === current && !done;
        return (
          <li key={label} aria-current={index === current ? "step" : undefined}>
            <span
              aria-hidden="true"
              className={`ord-dot${done ? " is-done" : ""}${isCurrent ? " is-current" : ""}`}
            >
              {done && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className={`ord-step${index === current ? " is-on" : ""}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function MealItems({ order }: { order: CookOrder }) {
  return (
    <ul className="divide-y divide-ink-900/8">
      {order.items.map((item, index) => (
        <li
          key={`${order.id}-${item.menu_item_id ?? item.name}-${index}`}
          className="flex min-w-0 items-start justify-between gap-3 py-2.5 text-sm"
        >
          <div className="min-w-0">
            <p className="break-words font-medium text-ink-900">
              {item.name}
            </p>
            {item.description && (
              <p className="mt-0.5 break-words text-xs leading-5 text-ink-900/55">
                {item.description}
              </p>
            )}
            <div className="mt-1 space-y-0.5 text-xs text-ink-900/60">
              <p>Quantity: {item.quantity}</p>
              <p>Unit price: {formatCurrency(item.unit_price)}</p>
              {!checkLineTotalConsistency(item) && (
                <p className="font-medium text-clay-600">
                  Price breakdown needs checking
                </p>
              )}
            </div>
          </div>
          <span className="shrink-0 pt-0.5 text-sm font-medium text-ink-900">
            {formatCurrency(item.line_total)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function OrderCard({
  order,
  pickupCode,
  submitting,
  actionError,
  onPickupCodeChange,
  onTransition,
}: {
  order: CookOrder;
  pickupCode: string;
  submitting: boolean;
  actionError: string | null;
  onPickupCodeChange: (value: string) => void;
  onTransition: (transition: Transition) => void;
}) {
  const isCompleted = order.status === "collected";
  const isReady = order.status === "ready";
  const mealNames = order.items.map((item) => item.name).join(", ");

  if (isCompleted) {
    return (
      <article className="ord-card is-plain">
        <div className="ord-row">
          <DateTile date={order.pickup_date} small />
          <div className="ord-grow">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <StatusBadge status="neutral" className="shrink-0">
                {getStatusLabel(order.status)}
              </StatusBadge>
              <p className="break-all font-mono text-[11px] text-ink-900/55">
                <span className="sr-only">Order </span>
                {order.id}
              </p>
            </div>
            <h2
              className="mt-2 font-display text-lg font-semibold leading-snug text-ink-900"
              style={{ overflowWrap: "anywhere" }}
            >
              {mealNames || "Meal details"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-ink-900/65">
              {order.hub} · {formatPickupDate(order.pickup_date)} ·{" "}
              {formatPickupTime(order.pickup_time)}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p className="text-xs text-ink-900/55">Accepted meal subtotal</p>
            <p className="text-lg font-semibold tracking-tight text-ink-900">
              {formatCurrency(order.meal_subtotal)}
            </p>
          </div>
        </div>

        <details className="ord-compact">
          <summary>Meal details</summary>
          <MealItems order={order} />
        </details>
      </article>
    );
  }

  return (
    <article className={`ord-card${isReady ? " is-ready" : ""}`}>
      <div className="ord-row">
        <DateTile date={order.pickup_date} />

        <div className="ord-grow">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-900/50">
                Order
              </p>
              <p className="mt-1 break-all font-mono text-xs text-ink-900/65">
                {order.id}
              </p>
            </div>
            <StatusBadge status={getStatusTone(order.status)} className="shrink-0">
              {getStatusLabel(order.status)}
            </StatusBadge>
          </div>

          <h2
            className="mt-3 font-display text-2xl font-semibold leading-snug tracking-tight text-ink-900"
            style={{ overflowWrap: "anywhere" }}
          >
            {mealNames || "Meal details"}
          </h2>
        </div>
      </div>

      <OrderProgress status={order.status} />

      <div className="ord-meal">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Utensils aria-hidden="true" className="size-4 shrink-0 text-clay-500" />
            <h3>Meal details</h3>
          </div>
          <MealItems order={order} />
        </div>

        <div className="ord-subtotal sm:min-w-36">
          <p className="text-xs text-ink-900/55">Accepted meal subtotal</p>
          <p className="mt-1 font-display text-3xl font-medium tracking-tight text-ink-900">
            {formatCurrency(order.meal_subtotal)}
          </p>
        </div>
      </div>

      <dl className="ord-facts">
        <div className="flex min-w-0 items-start gap-2.5">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-clay-500" />
          <div className="min-w-0">
            <dt className="text-xs text-ink-900/55">Pickup hub</dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-ink-900">
              {order.hub}
            </dd>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2.5">
          <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-clay-500" />
          <div className="min-w-0">
            <dt className="text-xs text-ink-900/55">Pickup date</dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-ink-900">
              {formatPickupDate(order.pickup_date)}
            </dd>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2.5">
          <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-clay-500" />
          <div className="min-w-0">
            <dt className="text-xs text-ink-900/55">Pickup time</dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-ink-900">
              {formatPickupTime(order.pickup_time)}
            </dd>
          </div>
        </div>
      </dl>

      <div className="ord-action">
        {order.payment_status === "pending" && (
          <p className="mb-3 rounded-md border border-saffron-500/30 bg-saffron-500/10 p-3 text-xs leading-5 text-ink-900/75">
            Cash is due directly to you when the customer collects this
            order. Confirm collection only after receiving payment and
            checking the pickup code.
          </p>
        )}
        {isReady ? (
          <div className="ord-code space-y-3">
            <div>
              <label
                htmlFor={`pickup-code-${order.id}`}
                className="text-sm font-semibold text-ink-900"
              >
                Customer pickup code
              </label>
              <p className="mt-1 text-xs leading-5 text-ink-900/60">
                Ask the customer to show their code before confirming collection.
              </p>
              <Input
                id={`pickup-code-${order.id}`}
                value={pickupCode}
                onChange={(event) => onPickupCodeChange(event.target.value)}
                disabled={submitting}
                maxLength={64}
                autoComplete="off"
                placeholder="Enter pickup code"
                className="mt-2 min-h-11 rounded-md"
              />
            </div>
            <Button
              type="button"
              onClick={() => onTransition("collect")}
              disabled={submitting}
              className="min-h-12 w-full px-6 py-2 text-sm sm:w-auto"
              style={{ borderRadius: 999 }}
            >
              {submitting ? (
                "Confirming collection..."
              ) : (
                <>
                  <Check aria-hidden="true" className="size-4" />
                  Confirm collection
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => onTransition("ready")}
            disabled={submitting}
            className="min-h-12 w-full px-6 py-2 text-sm sm:w-auto"
            style={{ borderRadius: 999 }}
          >
            {submitting ? (
              "Updating order..."
            ) : (
              <>
                <PackageCheck aria-hidden="true" className="size-4" />
                Mark as ready
              </>
            )}
          </Button>
        )}
        {actionError && (
          <p className="mt-3 text-sm leading-5 text-red-700" role="alert">
            {actionError}
          </p>
        )}
      </div>
    </article>
  );
}

export default function CookOrdersPage() {
  const [orders, setOrders] = useState<CookOrder[]>([]);
  const [stage, setStage] = useState<OrderStage>("confirmed");
  const [pickupCodes, setPickupCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{
    orderId: string;
    message: string;
  } | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(
    null,
  );
  const mounted = useRef(false);
  const requestSequence = useRef(0);
  const submissionLock = useRef(false);

  const loadOrders = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setRefreshing(true);
    setError(null);

    try {
      const loadedOrders = await fetchCookOrders();

      if (mounted.current && sequence === requestSequence.current) {
        setOrders(loadedOrders);
      }
    } catch (loadError) {
      if (mounted.current && sequence === requestSequence.current) {
        setError(getLoadError(loadError));
      }
    } finally {
      if (mounted.current && sequence === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const sequence = ++requestSequence.current;

    void fetchCookOrders()
      .then((loadedOrders) => {
        if (mounted.current && sequence === requestSequence.current) {
          setOrders(loadedOrders);
        }
      })
      .catch((loadError: unknown) => {
        if (mounted.current && sequence === requestSequence.current) {
          setError(getLoadError(loadError));
        }
      })
      .finally(() => {
        if (mounted.current && sequence === requestSequence.current) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      mounted.current = false;
      requestSequence.current += 1;
    };
  }, []);

  const visibleOrders = orders.filter(
    (order) => getStageForStatus(order.status) === stage,
  ).sort((first, second) => {
    const firstTime = new Date(`${first.pickup_date}T${first.pickup_time}+02:00`).getTime();
    const secondTime = new Date(`${second.pickup_date}T${second.pickup_time}+02:00`).getTime();
    return stage === "completed" ? secondTime - firstTime : firstTime - secondTime;
  });

  function getStageCount(selectedStage: OrderStage) {
    return orders.filter(
      (order) => getStageForStatus(order.status) === selectedStage,
    ).length;
  }

  async function handleTransition(order: CookOrder, transition: Transition) {
    if (submissionLock.current) return;

    const pickupCode = pickupCodes[order.id]?.trim() ?? "";

    if (transition === "collect" && !pickupCode) {
      setActionError({
        orderId: order.id,
        message: "Enter the customer's pickup code to continue.",
      });
      return;
    }

    submissionLock.current = true;
    setSubmittingOrderId(order.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      let response: Response;

      try {
        response = await fetch(
          `/api/cook/orders/${encodeURIComponent(order.id)}/${transition}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            ...(transition === "collect"
              ? { body: JSON.stringify({ pickupCode }) }
              : {}),
          },
        );
      } catch {
        throw new Error("Could not reach the order service. Try again.");
      }

      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        throw new Error("The order service returned an unreadable response.");
      }

      if (!response.ok) {
        throw new Error(getActionError(payload));
      }

      if (!isRecord(payload) || payload.success !== true) {
        throw new Error("The order service returned an unexpected response.");
      }

      setActionSuccess(
        transition === "ready"
          ? "Order marked ready for pickup."
          : "Collection confirmed.",
      );
      setPickupCodes((current) => ({ ...current, [order.id]: "" }));
      await loadOrders();
    } catch (transitionError) {
      setActionError({
        orderId: order.id,
        message:
          transitionError instanceof Error
            ? transitionError.message
            : "We could not update this order. Please try again.",
      });
    } finally {
      submissionLock.current = false;
      setSubmittingOrderId(null);
    }
  }

  function handleRefresh() {
    setActionSuccess(null);
    void loadOrders();
  }

  return (
    <CookShell desktopActions={false}>
      <main className="min-h-screen bg-cream-50">
        <style>{orderStyles}</style>

        <div className="ck-wrap">
          <header className="ck-hero">
            <div className="ck-hero-bg" aria-hidden="true" />
            <div className="ck-hero-top" style={{ justifyContent: "flex-end" }}>
              <div className="ck-hero-actions">
                <NotificationBell />
                <AccountMenu links={cookAccountLinks} />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <p className="ck-eyebrow">Cook workspace</p>
              <h1 className="ck-h1 font-display tracking-tight text-ink-900">
                Your <span className="text-clay-500">orders.</span>
              </h1>
              <span
                aria-hidden="true"
                className="mt-4 block h-1 w-14 rounded-full bg-saffron-500"
              />
              <p className="mt-3 max-w-md text-sm leading-6 text-ink-900/75">
                Prepare confirmed meals, manage pickup handoffs, and review completed orders.
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="mt-4 min-h-11 w-full px-5 py-2 text-sm sm:w-auto"
                style={{ borderRadius: 999 }}
              >
                <RefreshCw
                  aria-hidden="true"
                  className={`size-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing..." : "Refresh orders"}
              </Button>
            </div>
          </header>

          {actionSuccess && (
            <div
              role="status"
              className="mt-5 flex items-start gap-2 rounded-md border border-sage-500/30 bg-sage-500/10 p-3 text-sm text-ink-900"
            >
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sage-500" />
              <p>{actionSuccess}</p>
            </div>
          )}

          <div role="group" aria-label="Order stages" className="ord-tabs">
            {stages.map((item) => {
              const active = stage === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStage(item.id)}
                  className="ord-tab"
                >
                  {item.label}
                  <b>{getStageCount(item.id)}</b>
                </button>
              );
            })}
          </div>

          <div className="ord-cols">
            <div className="ord-main">
              {loading && (
                <div className="ord-card is-plain">
                  <div className="flex items-center gap-3 text-sm text-ink-900/65" role="status">
                    <RefreshCw aria-hidden="true" className="size-4 animate-spin text-clay-500" />
                    Loading orders...
                  </div>
                </div>
              )}

              {!loading && error && orders.length === 0 && (
                <div className="ord-card" style={{ border: "1px solid rgba(180,71,43,.25)" }}>
                  <h2 className="font-display text-xl font-semibold text-ink-900">
                    Unable to load orders
                  </h2>
                  <p className="mt-2 break-words text-sm leading-6 text-red-700" role="alert">
                    {error}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="mt-4 min-h-11 rounded-md px-4 py-2 text-sm"
                  >
                    Try again
                  </Button>
                </div>
              )}

              {!loading && error && orders.length > 0 && (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-clay-500/25 bg-white p-3 text-sm"
                  role="alert"
                >
                  <p className="break-words text-red-700">{error}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="min-h-10 rounded-md px-3 py-1.5 text-sm"
                  >
                    Retry
                  </Button>
                </div>
              )}

              {!loading && (!error || orders.length > 0) && (
                <section
                  aria-label={`${stages.find((item) => item.id === stage)?.label ?? "Orders"} orders`}
                  style={{ display: "flex", flexDirection: "column", gap: 18 }}
                >
                  {visibleOrders.length === 0 ? (
                    <div className="ord-empty">
                      <PackageCheck
                        aria-hidden="true"
                        className="mx-auto size-8 text-ink-900/35"
                      />
                      <h2 className="mt-3 font-display text-xl font-semibold text-ink-900">
                        {stage === "confirmed"
                          ? "No confirmed orders"
                          : stage === "ready"
                            ? "No orders awaiting pickup"
                            : "No completed orders yet"}
                      </h2>
                      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-900/60">
                        {stage === "confirmed"
                          ? "Paid orders will appear here when customers confirm a cook offer."
                          : stage === "ready"
                            ? "Orders you mark ready will appear here until collection is confirmed."
                            : "Collected orders will be kept here for reference."}
                      </p>
                      {stage === "confirmed" && (
                        <Link
                          href="/cook"
                          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-clay-500 px-5 text-sm font-semibold text-clay-500 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                        >
                          View incoming requests
                        </Link>
                      )}
                    </div>
                  ) : (
                    visibleOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        pickupCode={pickupCodes[order.id] ?? ""}
                        submitting={submittingOrderId === order.id}
                        actionError={
                          actionError?.orderId === order.id
                            ? actionError.message
                            : null
                        }
                        onPickupCodeChange={(value) => {
                          setPickupCodes((current) => ({
                            ...current,
                            [order.id]: value,
                          }));
                          setActionError(null);
                        }}
                        onTransition={(transition) => {
                          void handleTransition(order, transition);
                        }}
                      />
                    ))
                  )}
                </section>
              )}
            </div>

            <aside className="ord-side" aria-label="Handover guidance">
              <section className="ord-note" aria-labelledby="handover-heading">
                <h2
                  id="handover-heading"
                  className="font-display text-xl font-semibold text-ink-900"
                >
                  Before you hand over a meal
                </h2>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-ink-900/80">
                  <li>Check the customer’s pickup code.</li>
                  <li>Collect the cash directly from the customer.</li>
                  <li>Then confirm collection.</li>
                </ol>
              </section>
              <section className="ord-dark" aria-labelledby="cash-heading">
                <h2
                  id="cash-heading"
                  className="text-[11px] font-bold uppercase tracking-[0.1em] text-saffron-500"
                >
                  Cash payments
                </h2>
                <p className="mt-2 text-sm leading-6 text-cream-50/90">
                  Customers pay you in cash at pickup. StewRun does not collect
                  cash at the hub.
                </p>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </CookShell>
  );
}