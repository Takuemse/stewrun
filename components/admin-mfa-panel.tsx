"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type MfaStatus = {
  currentLevel: string | null;
  hasVerifiedTotp: boolean;
  hasPendingTotp: boolean;
  verifiedTotpFactorId: string | null;
  pendingTotpFactorId: string | null;
};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

async function postMfaAction(
  action: string,
  values: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const response = await fetch("/api/admin/mfa/enroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ action, ...values }),
  });
  const result: unknown = await response.json();

  if (
    typeof result !== "object" ||
    result === null ||
    Array.isArray(result)
  ) {
    throw new Error("The MFA service returned an invalid response.");
  }

  const payload = result as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "MFA action failed. Please try again.",
    );
  }

  return payload;
}

export default function AdminMfaPanel() {
  const router = useRouter();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/mfa/status", {
        cache: "no-store",
      });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        typeof result !== "object" ||
        result === null ||
        Array.isArray(result)
      ) {
        const payload =
          typeof result === "object" && result !== null
            ? (result as Record<string, unknown>)
            : {};
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Unable to check administrator MFA status.",
        );
      }

      const nextStatus = result as MfaStatus;
      setStatus(nextStatus);
      if (
        nextStatus.currentLevel === "aal2" &&
        nextStatus.hasVerifiedTotp &&
        !nextStatus.hasPendingTotp
      ) {
        router.replace("/");
        router.refresh();
      }
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to check administrator MFA status.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshStatus]);

  async function startEnrollment() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await postMfaAction("start");
      if (
        typeof result.factorId !== "string" ||
        typeof result.qrCode !== "string" ||
        typeof result.secret !== "string"
      ) {
        throw new Error("The authenticator setup response was incomplete.");
      }
      setEnrollment({
        factorId: result.factorId,
        qrCode: result.qrCode,
        secret: result.secret,
      });
      setCode("");
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to start authenticator setup.",
      );
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!status || !code) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (enrollment) {
        await postMfaAction("verify", {
          factorId: enrollment.factorId,
          code,
        });
        setEnrollment(null);
        setMessage("Authenticator verified. Redirecting…");
      } else {
        const factorId = status.verifiedTotpFactorId;
        if (!factorId) {
          throw new Error("No verified authenticator is available.");
        }
        await postMfaAction("challenge-and-verify", {
          factorId,
          code,
        });
        setMessage("MFA verified. Redirecting…");
      }

      setCode("");
      await refreshStatus();
    } catch (verifyError) {
      setCode("");
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "That code could not be verified. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetPendingEnrollment() {
    const factorId = status?.pendingTotpFactorId;
    if (!factorId) return;

    setBusy(true);
    setError(null);
    try {
      await postMfaAction("cancel-pending", { factorId });
      setEnrollment(null);
      setMessage("Interrupted setup removed. You can start again.");
      await refreshStatus();
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Unable to reset the pending setup.",
      );
    } finally {
      setBusy(false);
    }
  }

  const pendingSetup = Boolean(
    status?.hasPendingTotp &&
      !enrollment &&
      (!status.hasVerifiedTotp || status.currentLevel === "aal2"),
  );
  const needsChallenge = Boolean(
    status?.hasVerifiedTotp &&
      status.currentLevel !== "aal2" &&
      !enrollment,
  );
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-50 px-5 py-10 sm:px-8">
      <Card className="w-full max-w-lg border border-ink-900/10 p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-sage-500">
          Administrator sign-in protection
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight text-ink-900">
          Authenticator verification
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-900/70">
          Set up or verify a time-based code for the allowlisted administrator
          account. This does not enroll automatically.
        </p>

        {loading && (
          <p role="status" className="mt-6 text-sm text-ink-900/70">
            Checking administrator MFA…
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-clay-500/25 bg-clay-500/5 px-4 py-3 text-sm leading-5 text-ink-900"
          >
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-5 text-sm text-sage-500">
            {message}
          </p>
        )}

        {!loading && status && !enrollment && !pendingSetup && !needsChallenge && (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void startEnrollment()}
            className="mt-6 w-full"
          >
            {busy ? "Starting setup…" : "Set up authenticator"}
          </Button>
        )}

        {!loading && pendingSetup && (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-ink-900/75">
              An authenticator setup is pending, but its QR and manual key
              were not retained after the previous session. Remove that
              unverified setup to begin again.
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void resetPendingEnrollment()}
            >
              Reset interrupted setup
            </Button>
          </div>
        )}

        {enrollment && (
          <div className="mt-6 space-y-5">
            <div className="rounded-lg border border-ink-900/10 bg-white p-4">
              <p className="text-sm font-semibold text-ink-900">
                Scan this QR code using your authenticator app
              </p>
              <Image
                src={enrollment.qrCode.trimEnd()}
                alt="TOTP authenticator setup QR code"
                width={220}
                height={220}
                unoptimized
                className="mx-auto mt-4 size-56 max-w-full"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-900">
                Manual setup key
              </p>
              <p className="mt-2 break-all rounded-lg bg-cream-50 p-3 font-mono text-sm text-ink-900">
                {enrollment.secret}
              </p>
              <p className="mt-2 text-xs leading-5 text-ink-900/65">
                Keep this key private. It is shown only during setup and is
                not included in a URL.
              </p>
            </div>
          </div>
        )}

        {!loading && needsChallenge && (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-ink-900/75">
              Enter the current six-digit code from your enrolled authenticator
              app. A fresh verification challenge is created for each attempt.
            </p>
          </div>
        )}

        {(enrollment || needsChallenge) && (
          <form onSubmit={verifyCode} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="authenticator-code"
                className="mb-2 block text-sm font-medium text-ink-900"
              >
                Authenticator code
              </label>
              <Input
                id="authenticator-code"
                name="authenticator-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern={enrollment ? "[0-9]{6,8}" : "[0-9]{6}"}
                maxLength={enrollment ? 8 : 6}
                required
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, enrollment ? 8 : 6),
                  )
                }
                className="min-h-12 tracking-[0.3em]"
              />
            </div>
            <Button
              type="submit"
              disabled={busy || code.length < 6}
              aria-busy={busy}
              className="w-full"
            >
              {busy
                ? "Verifying…"
                : enrollment
                  ? "Verify and enable authenticator"
                  : "Verify sign-in"}
            </Button>
          </form>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || loading}
            onClick={() => void refreshStatus()}
          >
            Refresh status
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.replace("/login")}
          >
            Return to sign in
          </Button>
        </div>
      </Card>
    </main>
  );
}
