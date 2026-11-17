
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

    throw new Error(auth.error);
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
