"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function ProfileSignOut() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        setErrorMessage("We could not sign you out. Please try again.");
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || data.session) {
        setErrorMessage("Your session could not be cleared. Please try again.");
        return;
      }

      window.location.replace("/login");
    } catch {
      setErrorMessage("We could not sign you out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <p role="alert" className="text-sm text-clay-500">
          {errorMessage}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        disabled={isSigningOut}
        onClick={() => void handleSignOut()}
      >
        {isSigningOut ? "Signing out..." : "Sign out"}
      </Button>
    </div>
  );
}
