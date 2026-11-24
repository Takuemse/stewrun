
import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getAuthenticatedUser } from "@/lib/supabase/auth.server";

async function CookLayoutContent({
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

    return (
      <main className="flex min-h-screen items-center justify-center bg-cream-50 px-5 py-12">
        <section className="w-full max-w-lg rounded-xl border border-ink-900/10 bg-white p-6 text-center shadow-none sm:p-9">
          <h1 className="font-display text-2xl text-ink-900">We could not open the cook workspace</h1>
          <p className="mt-3 text-sm leading-6 text-ink-900/65">Your session could not be checked. Please try again, or sign in again if the problem continues.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href="/cook" className="inline-flex min-h-11 items-center rounded-md bg-clay-500 px-5 text-sm font-semibold text-white">Try again</a>
            <a href="/login" className="inline-flex min-h-11 items-center rounded-md border border-ink-900/15 px-5 text-sm font-semibold text-ink-900">Sign in</a>
          </div>
        </section>
      </main>
    );
  }

  if (auth.role === "customer") {
    redirect("/dashboard");
  }

  return children;
}

export default function CookLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading cook workspace...
        </div>
      }
    >
      <CookLayoutContent>{children}</CookLayoutContent>
    </Suspense>
  );
}
