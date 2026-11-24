import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import AccountSignOut from "@/components/account-sign-out";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import CustomerProfileForm from "@/components/customer-profile-form";
import ProfileView from "@/components/profile-view";
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

  const email = auth.user.email ?? null;
  const metadata = (auth.user as { user_metadata?: { full_name?: unknown } })
    .user_metadata;
  const metaName =
    typeof metadata?.full_name === "string" ? metadata.full_name.trim() : "";
  const name = metaName || email?.split("@")[0] || "Your account";

  return (
    <ProfileView
      name={name}
      email={email}
      form={<CustomerProfileForm />}
      signOut={<AccountSignOut />}
    />
  );
}