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

