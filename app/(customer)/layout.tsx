import { Suspense } from "react";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import CustomerNavigation from "@/components/customer-navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth.server";

export default function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="flex min-h-16 items-center border-b border-ink-900/10 bg-cream-50 px-5 text-sm text-ink-900/65 sm:px-8"
        >
          Checking your account...
        </div>
      }
    >
      <AuthenticatedCustomerLayout>{children}</AuthenticatedCustomerLayout>
    </Suspense>
  );
}

async function AuthenticatedCustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    if (auth.status === 401) {
      redirect("/login");
    }

    throw new Error(auth.error);
  }

  if (auth.role === "cook") {
    redirect("/cook");
  }

  return (
    <>
      {/* Offsets the content for the desktop sidebar (15rem) and the mobile
          bottom navigation. Scoped so it does not rely on new utilities. */}
      <style>{`
        .customer-content{padding-bottom:calc(4rem + env(safe-area-inset-bottom, 0px))}
        @media (min-width:1024px){
          .customer-content{padding-left:15rem;padding-bottom:0}
        }
      `}</style>
      <Suspense fallback={null}>
        <CustomerNavigation />
      </Suspense>
      <div className="customer-content">{children}</div>
    </>
  );
}