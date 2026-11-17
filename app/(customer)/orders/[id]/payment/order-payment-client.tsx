"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import {
  CustomerOrderApiError,
  fetchCustomerOrder,
  type CustomerOrder,
} from "@/lib/orders-client";

function formatCurrency(amount: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount));
}

export default function OrderPaymentClient({
  orderId,
}: {
  orderId: string;
}) {
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadOrder() {
      try {
        const loadedOrder = await fetchCustomerOrder(orderId);
        if (active) {
          setOrder(loadedOrder);
          setLoadError(null);
          setUnauthorized(false);
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "We could not load this order. Please try again.",
          );
          setUnauthorized(
            error instanceof CustomerOrderApiError &&
              (error.status === 401 || error.status === 403),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadOrder();
    return () => {
      active = false;
    };
  }, [orderId]);

  const cashDue = order?.cash_payment_status === "due";
  const cashPaid = order?.cash_payment_status === "paid";

  return (
    <main className="min-h-screen bg-cream-50">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/orders"
          className="text-sm font-semibold text-clay-500 hover:text-ink-900"
        >
          ← Back to my orders
        </Link>

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
          Order payment
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
          Payment instructions
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-900/65 sm:text-base">
          StewRun accepts cash paid directly to your cook when you collect your
          meal. StewRun does not collect cash at pickup.
        </p>

        {loading && (
          <div className="mt-8 rounded-xl border border-ink-900/10 bg-white p-8 text-center" role="status">
            Loading order details...
          </div>
        )}

        {!loading && loadError && (
          <Card className="mt-8 border border-clay-500/25 shadow-none">
            <h2 className="font-display text-xl font-semibold text-ink-900">
              We could not load this order
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-900/70">{loadError}</p>
            {unauthorized && (
              <Link
                href="/login"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-clay-500 px-5 text-sm font-semibold text-cream-50 hover:opacity-90"
              >
                Sign in
              </Link>
            )}
          </Card>
        )}

        {!loading && !loadError && order && (
          <Card className="mt-8 border border-saffron-500/30 shadow-none">
            {cashDue ? (
              <>
                <h2 className="font-display text-xl font-semibold text-ink-900">
                  Pay your cook at pickup
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-900/70">
                  Bring <span className="font-semibold">{formatCurrency(order.total)}</span> and pay
                  the cook directly in cash when collecting your meal.
                </p>
                {order.hub && (
                  <p className="mt-3 text-sm text-ink-900/70">
                    Pickup hub: <span className="font-semibold text-ink-900">{order.hub}</span>
                  </p>
                )}
              </>
            ) : cashPaid ? (
              <>
                <h2 className="font-display text-xl font-semibold text-ink-900">
                  Cash payment recorded
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-900/70">
                  Your cook recorded cash payment when your order was collected.
                </p>
              </>
            ) : order.payment_status === "pending" ? (
              <>
                <h2 className="font-display text-xl font-semibold text-ink-900">
                  Online payment is paused
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-900/70">
                  EcoCash payments are not available yet. This order has not been
                  changed to cash at pickup. Please contact StewRun support for
                  help with its current payment status.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl font-semibold text-ink-900">
                  No payment is due
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-900/70">
                  Current payment status: {order.payment_status.replaceAll("_", " ")}.
                  Review your order for the latest pickup details.
                </p>
              </>
            )}
            <Link
              href="/orders"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-clay-500 px-5 text-sm font-semibold text-cream-50 hover:opacity-90"
            >
              View my orders
            </Link>
          </Card>
        )}
      </div>
    </main>
  );
}
