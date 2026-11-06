
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

export type AppRole = "customer" | "cook";

export type AuthResult =
  | {
      ok: true;
      user: User;
      role: AppRole;
    }
  | {
      ok: false;
      status: 401 | 403 | 500;
      error: string;
    };

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie updates may not be available in Server Components.
          }
        },
      },
    },
  );
}

export async function getAuthenticatedUser(): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Authentication lookup failed:", {
      message: authError.message,
      status: authError.status,
    });

    // Only HTTP 4xx errors indicate an invalid client session.
    // Server-side, connection, and unexpected errors remain 500.
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

  const { data: userRecord, error: dbError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (dbError) {
    console.error("User role lookup failed:", {
      message: dbError.message,
      code: dbError.code,
    });

    return {
      ok: false,
      status: 500,
      error: "Unable to verify user permissions.",
    };
  }

  if (
    !userRecord ||
    (userRecord.role !== "customer" && userRecord.role !== "cook")
  ) {
    return {
      ok: false,
      status: 403,
      error: "A valid application account is required.",
    };
  }

  return {
    ok: true,
    user,
    role: userRecord.role,
  };
}
