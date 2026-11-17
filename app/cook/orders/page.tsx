"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
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

import AccountSignOut from "@/components/account-sign-out";
import NotificationBell from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
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

  return (
    <Card className="min-w-0 border border-ink-900/10 p-4 shadow-none sm:p-5">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-900/50">
              Order
            </p>
            <p className="mt-1 break-all font-mono text-xs text-ink-900/65">
              {order.id}
            </p>
          </div>
          <StatusBadge
            status={isCompleted ? "neutral" : getStatusTone(order.status)}
            className="shrink-0"
          >
            {getStatusLabel(order.status)}
          </StatusBadge>
        </div>

        <div className="grid min-w-0 gap-4 border-y border-ink-900/10 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Utensils aria-hidden="true" className="size-4 shrink-0 text-clay-500" />
              <h2>Meal details</h2>
            </div>
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
                    <p className="mt-1 text-xs text-ink-900/60">
                      Quantity: {item.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 pt-0.5 text-sm font-medium text-ink-900">
                    {formatCurrency(item.line_total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-ink-900/10 pt-3 sm:min-w-36 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <p className="text-xs text-ink-900/55">Accepted meal subtotal</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-ink-900">
              {formatCurrency(order.meal_subtotal)}
            </p>
          </div>
        </div>

        <dl className="grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
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

        {!isCompleted && (
          <div className="border-t border-ink-900/10 pt-4">
            {order.payment_status === "pending" && (
              <p className="mb-3 rounded-md border border-saffron-500/30 bg-saffron-500/10 p-3 text-xs leading-5 text-ink-900/75">
                Cash is due directly to you when the customer collects this
                order. Confirm collection only after receiving payment and
                checking the pickup code.
              </p>
            )}
            {isReady ? (
              <div className="space-y-3">
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
                  className="min-h-11 w-full rounded-md px-4 py-2 text-sm sm:w-auto"
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
                className="min-h-11 w-full rounded-md px-4 py-2 text-sm sm:w-auto"
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
        )}
      </div>
    </Card>
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
    <main className="min-h-screen bg-cream-50">
      <header className="border-b border-ink-900/10 bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link
            href="/"
            className="font-display text-xl font-semibold tracking-tight text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
          >
            StewRun
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            <nav
              aria-label="Cook workspace navigation"
              className="flex flex-wrap items-center gap-1"
            >
              <Link
                href="/cook"
                className="inline-flex min-h-10 items-center rounded-md px-2.5 text-sm font-medium text-ink-900/70 hover:bg-cream-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 sm:px-3"
              >
                Requests
              </Link>
              <Link
                href="/cook/orders"
                aria-current="page"
                className="inline-flex min-h-10 items-center rounded-md bg-cream-100 px-2.5 text-sm font-semibold text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 sm:px-3"
              >
                Orders
              </Link>
              <Link
                href="/cook/menu"
                className="inline-flex min-h-10 items-center rounded-md px-2.5 text-sm font-medium text-ink-900/70 hover:bg-cream-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 sm:px-3"
              >
                Menu
              </Link>
              <Link
                href="/cook/profile"
                className="inline-flex min-h-10 items-center rounded-md px-2.5 text-sm font-medium text-ink-900/70 hover:bg-cream-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 sm:px-3"
              >
                Profile
              </Link>
            </nav>
            <NotificationBell />
            <AccountSignOut />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <section className="flex flex-col justify-between gap-4 border-b border-ink-900/10 pb-6 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-clay-500">
              Cook workspace
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
              Orders
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-ink-900/65">
              Prepare confirmed meals, manage pickup handoffs, and review completed orders.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="min-h-11 w-full shrink-0 rounded-md px-3 py-2 text-sm sm:w-auto"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing..." : "Refresh orders"}
          </Button>
        </section>

        {actionSuccess && (
          <div
            role="status"
            className="mt-5 flex items-start gap-2 rounded-md border border-sage-500/30 bg-sage-500/10 p-3 text-sm text-ink-900"
          >
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sage-500" />
            <p>{actionSuccess}</p>
          </div>
        )}

        <div
          role="group"
          aria-label="Order stages"
          className="mt-6 flex min-w-0 gap-2 overflow-x-auto pb-2"
        >
          {stages.map((item) => {
            const active = stage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setStage(item.id)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 ${
                  active
                    ? "border-ink-900 bg-ink-900 font-semibold text-white"
                    : "border-ink-900/10 bg-white font-medium text-ink-900/70 hover:border-ink-900/25"
                }`}
              >
                {item.label}
                <span
                  className={`inline-flex min-w-6 items-center justify-center rounded px-1.5 py-0.5 text-xs ${
                    active
                      ? "bg-white/15 text-white"
                      : "bg-cream-100 text-ink-900/65"
                  }`}
                >
                  {getStageCount(item.id)}
                </span>
              </button>
            );
          })}
        </div>

        {loading && (
          <Card className="mt-4 border border-ink-900/10 p-6 shadow-none">
            <div className="flex items-center gap-3 text-sm text-ink-900/65" role="status">
              <RefreshCw aria-hidden="true" className="size-4 animate-spin text-clay-500" />
              Loading orders...
            </div>
          </Card>
        )}

        {!loading && error && orders.length === 0 && (
          <Card className="mt-4 border border-clay-500/25 p-5 shadow-none">
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
          </Card>
        )}

        {!loading && error && orders.length > 0 && (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-clay-500/25 bg-white p-3 text-sm"
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
            className="mt-4"
          >
            {visibleOrders.length === 0 ? (
              <Card className="border border-ink-900/10 p-6 text-center shadow-none sm:p-8">
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
                    className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-ink-900/15 px-3 text-sm font-semibold text-ink-900 hover:bg-cream-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                  >
                    View incoming requests
                  </Link>
                )}
              </Card>
            ) : (
              <div className="grid gap-3">
                {visibleOrders.map((order) => (
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
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
