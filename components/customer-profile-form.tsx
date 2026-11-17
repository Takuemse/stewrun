"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CustomerProfile = { full_name: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export default function CustomerProfileForm() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const payload: unknown = await response.json();

        if (!response.ok) {
          throw new Error(
            isRecord(payload) && typeof payload.error === "string"
              ? payload.error
              : "Unable to load your profile.",
          );
        }

        if (
          !isRecord(payload) ||
          !isRecord(payload.profile) ||
          typeof payload.profile.full_name !== "string"
        ) {
          throw new Error("The profile response was invalid.");
        }

        if (active) setProfile({ full_name: payload.profile.full_name });
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load your profile.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Unable to save your profile.",
        );
      }

      if (
        !isRecord(payload) ||
        !isRecord(payload.profile) ||
        typeof payload.profile.full_name !== "string"
      ) {
        throw new Error("The saved profile response was invalid.");
      }

      setProfile({ full_name: payload.profile.full_name });
      setSuccess("Your name has been saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-900/60" role="status">Loading profile...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-700" role="alert">{error}</p>
      )}
      {success && (
        <p className="text-sm text-sage-700" role="status">{success}</p>
      )}
      {profile && (
        <label className="block space-y-2 text-sm font-medium text-ink-900">
          Name
          <Input
            value={profile.full_name}
            onChange={(event) =>
              setProfile({ full_name: event.target.value })
            }
            minLength={2}
            maxLength={100}
            required
            className="min-h-11 rounded-md"
          />
        </label>
      )}
      <Button
        type="submit"
        disabled={saving || !profile}
        className="w-full rounded-md sm:w-auto"
      >
        {saving ? "Saving..." : "Save name"}
      </Button>
    </form>
  );
}
