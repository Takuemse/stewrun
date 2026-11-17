"use client";

import { useRef, useState } from "react";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

interface AccountSignOutProps {
  compact?: boolean;
}

export default function AccountSignOut({
  compact = false,
}: AccountSignOutProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const signOutInProgress = useRef(false);

  async function handleSignOut() {
    if (signOutInProgress.current) {
      return;
    }

    signOutInProgress.current = true;
    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage("We could not sign you out. Please try again.");
        return;
      }

      const { data, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || data.session) {
        setErrorMessage("Your session could not be cleared. Please try again.");
        return;
      }

      window.location.replace("/login");
    } catch {
      setErrorMessage("We could not sign you out. Please try again.");
    } finally {
      signOutInProgress.current = false;
      setIsSigningOut(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={isSigningOut}
        aria-busy={isSigningOut}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-ink-900/15 px-3 text-sm font-medium text-ink-900 hover:border-ink-900/30 hover:text-clay-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? "w-full flex-col gap-1 px-1 text-[10px]" : ""
        }`}
      >
        <LogOut aria-hidden="true" className="size-4" />
        <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
      </button>
      {errorMessage ? (
        <p role="alert" className="mt-1 text-xs leading-4 text-clay-500">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
