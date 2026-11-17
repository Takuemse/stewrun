import "server-only";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "./auth.server";

export type AdminAuthResult =
  | {
      ok: true;
      user: User;
    }
  | {
      ok: false;
      status: 401 | 403 | 500;
      error: string;
    };

export type AdminMfaContextResult =
  | {
      ok: true;
      user: User;
      currentLevel: string | null;
      verifiedTotpFactors: Array<{ id: string; friendlyName: string | null }>;
      pendingTotpFactors: Array<{ id: string; friendlyName: string | null }>;
    }
  | {
      ok: false;
      status: 401 | 403 | 500;
      error: string;
    };

export async function getAuthenticatedAdmin(): Promise<AdminAuthResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Admin authentication lookup failed:", {
      message: authError.message,
      status: authError.status,
    });

    if (
      typeof authError.status === "number" &&
      authError.status >= 400 &&
      authError.status < 500
    ) {
      return {
        ok: false,
        status: 401,
        error: "Authentication required.",
      };
    }

    return {
      ok: false,
      status: 500,
      error: "Unable to verify authentication.",
    };
  }

  if (!user) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required.",
    };
  }

  const allowedAdminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  if (!allowedAdminIds.includes(user.id.toLowerCase())) {
    return {
      ok: false,
      status: 403,
      error: "Administrator access required.",
    };
  }

  return {
    ok: true,
    user,
  };
}

export async function getAuthenticatedAdminMfaContext(): Promise<AdminMfaContextResult> {
  const admin = await getAuthenticatedAdmin();

  if (!admin.ok) {
    return admin;
  }

  const supabase = await createServerSupabaseClient();
  const [assuranceResult, factorsResult] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);

  if (assuranceResult.error || factorsResult.error) {
    console.error("Administrator MFA status lookup failed:", {
      assuranceError: assuranceResult.error?.message,
      factorsError: factorsResult.error?.message,
    });

    return {
      ok: false,
      status: 500,
      error: "Unable to verify administrator MFA status.",
    };
  }

  const factors = factorsResult.data.all;

  return {
    ok: true,
    user: admin.user,
    currentLevel: assuranceResult.data.currentLevel,
    verifiedTotpFactors: factors
      .filter(
        (factor) =>
          factor.factor_type === "totp" &&
          factor.status === "verified",
      )
      .map((factor) => ({
        id: factor.id,
        friendlyName: factor.friendly_name ?? null,
      })),
    pendingTotpFactors: factors
      .filter(
        (factor) =>
          factor.factor_type === "totp" &&
          factor.status === "unverified",
      )
      .map((factor) => ({
        id: factor.id,
        friendlyName: factor.friendly_name ?? null,
      })),
  };
}

export async function requireAuthenticatedAdminAAL2(): Promise<AdminAuthResult> {
  const context = await getAuthenticatedAdminMfaContext();

  if (!context.ok) {
    return context;
  }

  if (context.currentLevel !== "aal2") {
    return {
      ok: false,
      status: 403,
      error: "Administrator MFA verification required.",
    };
  }

  return {
    ok: true,
    user: context.user,
  };
}
