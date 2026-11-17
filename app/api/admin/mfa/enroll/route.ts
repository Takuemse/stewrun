import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/auth.server";
import { readRequestBody } from "@/lib/request-body";
import { getAuthenticatedAdminMfaContext } from "@/lib/supabase/admin-auth.server";

const CODE_PATTERN = /^\d{6,8}$/;
const MAX_BODY_BYTES = 1024;

async function readJsonBody(request: Request): Promise<unknown | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return null;
  }

  const origin = request.headers.get("origin");
  let originMatches = false;
  try {
    originMatches =
      origin !== null && new URL(origin).origin === new URL(request.url).origin;
  } catch {
    originMatches = false;
  }
  if (!originMatches) {
    return null;
  }

  const contentLength = request.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) ||
      Number(contentLength) > MAX_BODY_BYTES)
  ) {
    return null;
  }

  const result = await readRequestBody(request, MAX_BODY_BYTES);
  if (!result.ok) {
    return null;
  }

  try {
    return JSON.parse(result.text);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action = (body as Record<string, unknown>).action;
  const supabase = await createServerSupabaseClient();

  if (action === "start") {
    const context = await getAuthenticatedAdminMfaContext();
    if (!context.ok) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    if (
      context.verifiedTotpFactors.length > 0 &&
      context.currentLevel !== "aal2"
    ) {
      return NextResponse.json(
        { error: "Verify administrator MFA before enrolling another factor." },
        { status: 403 },
      );
    }

    if (context.pendingTotpFactors.length > 0) {
      return NextResponse.json(
        {
          error:
            "An unverified authenticator setup already exists. Verify it or contact support to remove the pending setup.",
        },
        { status: 409 },
      );
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "StewRun administrator authenticator",
      issuer: "StewRun",
    });

    if (error) {
      console.error("Administrator TOTP enrollment failed:", {
        message: error.message,
        status: error.status,
      });
      return NextResponse.json(
        { error: "Unable to start authenticator setup." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (action === "verify") {
    const factorId = (body as Record<string, unknown>).factorId;
    const code = (body as Record<string, unknown>).code;

    if (
      typeof factorId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        factorId,
      ) ||
      typeof code !== "string" ||
      !CODE_PATTERN.test(code)
    ) {
      return NextResponse.json(
        { error: "Enter the current authenticator code." },
        { status: 400 },
      );
    }

    const context = await getAuthenticatedAdminMfaContext();
    if (!context.ok) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    if (!context.pendingTotpFactors.some((factor) => factor.id === factorId)) {
      return NextResponse.json(
        { error: "No matching pending authenticator setup was found." },
        { status: 409 },
      );
    }

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      console.error("Administrator TOTP enrollment challenge failed:", {
        message: challengeError.message,
        status: challengeError.status,
      });
      return NextResponse.json(
        { error: "Unable to create a verification challenge. Try again." },
        { status: 400 },
      );
    }

    if (challenge.expires_at <= Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: "The verification challenge expired. Try again." },
        { status: 409 },
      );
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      console.error("Administrator TOTP enrollment verification failed:", {
        message: verifyError.message,
        status: verifyError.status,
      });
      return NextResponse.json(
        { error: "That code could not be verified. Check it and try again." },
        { status: 400 },
      );
    }

    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance.currentLevel !== "aal2") {
      console.error("Administrator TOTP enrollment AAL2 check failed:", {
        message: assuranceError?.message,
        currentLevel: assurance?.currentLevel,
      });
      return NextResponse.json(
        { error: "The authenticator was verified but elevated access could not be confirmed. Refresh and retry." },
        { status: 500 },
      );
    }

    return NextResponse.json({ verified: true });
  }

  if (action === "challenge-and-verify") {
    const factorId = (body as Record<string, unknown>).factorId;
    const code = (body as Record<string, unknown>).code;

    if (
      typeof factorId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        factorId,
      ) ||
      typeof code !== "string" ||
      !/^\d{6}$/.test(code)
    ) {
      return NextResponse.json(
        { error: "Enter the current six-digit authenticator code." },
        { status: 400 },
      );
    }

    const context = await getAuthenticatedAdminMfaContext();
    if (!context.ok) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    if (!context.verifiedTotpFactors.some((factor) => factor.id === factorId)) {
      return NextResponse.json(
        { error: "No matching verified authenticator was found." },
        { status: 409 },
      );
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (error) {
      console.error("Administrator TOTP verification failed:", {
        message: error.message,
        status: error.status,
      });
      return NextResponse.json(
        { error: "That code could not be verified. Request a new code and try again." },
        { status: 400 },
      );
    }

    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance.currentLevel !== "aal2") {
      console.error("Administrator sign-in AAL2 check failed:", {
        message: assuranceError?.message,
        currentLevel: assurance?.currentLevel,
      });
      return NextResponse.json(
        { error: "The authenticator was verified but elevated access could not be confirmed. Refresh and retry." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { verified: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (action === "cancel-pending") {
    const factorId = (body as Record<string, unknown>).factorId;
    if (typeof factorId !== "string") {
      return NextResponse.json(
        { error: "Invalid authenticator factor." },
        { status: 400 },
      );
    }

    const context = await getAuthenticatedAdminMfaContext();
    if (!context.ok) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    if (!context.pendingTotpFactors.some((factor) => factor.id === factorId)) {
      return NextResponse.json(
        { error: "No matching pending authenticator setup was found." },
        { status: 409 },
      );
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      console.error("Administrator pending TOTP removal failed:", {
        message: error.message,
        status: error.status,
      });
      return NextResponse.json(
        { error: "Unable to reset the pending authenticator setup." },
        { status: 400 },
      );
    }

    return NextResponse.json({ removed: true });
  }

  return NextResponse.json({ error: "Invalid MFA action." }, { status: 400 });
}
