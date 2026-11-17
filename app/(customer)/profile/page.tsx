
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import AccountSignOut from "@/components/account-sign-out";
import { Card } from "@/components/ui/card";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import CustomerProfileForm from "@/components/customer-profile-form";
import { getAuthenticatedUser } from "@/lib/supabase/auth.server";

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream-50 px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-3xl">
            <LoadingIndicator label="Loading your account" />
          </div>
        </main>
      }
    >
      <AuthenticatedProfile />
    </Suspense>
  );
}

async function AuthenticatedProfile() {
  await connection();
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    if (auth.status === 401) {
      redirect("/login");
    }

    if (auth.status === 403) {
      redirect("/");
    }

    throw new Error(auth.error);
  }

  return (
    <main className="min-h-screen bg-cream-50 px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-clay-500 hover:text-ink-900"
        >
          ← Back to dashboard
        </Link>

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
          Your account
        </p>

        <h1 className="mt-3 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">
          Profile
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-900/70 sm:text-base">
          View your account details and customer activity.
        </p>

        <section aria-labelledby="account-details-heading" className="mt-8">
          <h2
            id="account-details-heading"
            className="mb-3 font-display text-xl font-semibold text-ink-900"
          >
            Account details
          </h2>
          <Card className="shadow-none">
            <CustomerProfileForm />
            <dl className="mt-6 border-t border-ink-900/10 pt-5">
              <div>
                <dt className="text-sm font-medium text-ink-900/65">
                  Email address
                </dt>
                <dd className="mt-1 break-all text-base font-semibold text-ink-900">
                  {auth.user.email ?? "No email address is associated with this account."}
                </dd>
              </div>
            </dl>
          </Card>
        </section>

        <section aria-labelledby="activity-heading" className="mt-8">
          <h2
            id="activity-heading"
            className="mb-3 font-display text-xl font-semibold text-ink-900"
          >
            Customer activity
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="shadow-none">
              <h3 className="font-semibold text-ink-900">My Requests</h3>
              <p className="mt-2 text-sm leading-6 text-ink-900/70">
                Review your meal requests and cook offers.
              </p>
              <Link
                href="/my-requests"
                className="mt-4 inline-flex min-h-12 items-center rounded-lg font-semibold text-clay-500 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
              >
                View my requests
              </Link>
            </Card>
            <Card className="shadow-none">
              <h3 className="font-semibold text-ink-900">My Orders</h3>
              <p className="mt-2 text-sm leading-6 text-ink-900/70">
                Review your orders, pickup details and cash-at-pickup instructions.
              </p>
              <Link
                href="/orders"
                className="mt-4 inline-flex min-h-12 items-center rounded-lg font-semibold text-clay-500 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
              >
                View my orders
              </Link>
            </Card>
          </div>
        </section>

        <section aria-labelledby="account-actions-heading" className="mt-8">
          <h2
            id="account-actions-heading"
            className="mb-3 font-display text-xl font-semibold text-ink-900"
          >
            Account actions
          </h2>
          <Card className="shadow-none">
            <AccountSignOut />
          </Card>
        </section>
      </div>
    </main>
  );
}
