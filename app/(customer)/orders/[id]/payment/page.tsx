import { Suspense } from "react";

import OrderPaymentClient from "./order-payment-client";

type PaymentPageProps = {
  params: Promise<{ id: string }>;
};

export default function OrderPaymentPage({ params }: PaymentPageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream-50 px-5 py-10 text-center text-ink-900">
          Loading payment details...
        </main>
      }
    >
      <OrderPaymentContent params={params} />
    </Suspense>
  );
}

async function OrderPaymentContent({ params }: PaymentPageProps) {
  const { id } = await params;

  return <OrderPaymentClient orderId={id} />;
}
