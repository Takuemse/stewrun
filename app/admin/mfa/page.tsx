import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import AdminMfaPanel from "@/components/admin-mfa-panel";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { getAuthenticatedAdminMfaContext } from "@/lib/supabase/admin-auth.server";

export default function AdminMfaPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-cream-50 px-5 py-10 sm:px-8">
          <LoadingIndicator label="Checking administrator access" />
        </main>
      }
    >
      <AdminMfaContent />
    </Suspense>
  );
}

async function AdminMfaContent() {
  await connection();
  const context = await getAuthenticatedAdminMfaContext();

  if (!context.ok) {
    redirect(context.status === 401 ? "/login" : "/");
  }

  return <AdminMfaPanel />;
}
