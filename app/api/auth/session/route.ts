import { NextResponse } from "next/server";

import { getAuthenticatedAdminMfaContext } from "@/lib/supabase/admin-auth.server";
import { getAuthenticatedUser } from "@/lib/supabase/auth.server";

function sessionResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET() {
  const admin = await getAuthenticatedAdminMfaContext();

  if (admin.ok) {
    return sessionResponse({
      role: "administrator",
      currentLevel: admin.currentLevel,
      hasVerifiedTotp: admin.verifiedTotpFactors.length > 0,
    });
  }

  if (admin.status !== 403) {
    return sessionResponse({ error: admin.error }, admin.status);
  }

  const appUser = await getAuthenticatedUser();

  if (!appUser.ok) {
    return sessionResponse({ error: appUser.error }, appUser.status);
  }

  return sessionResponse({ role: appUser.role });
}
