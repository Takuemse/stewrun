import { NextResponse } from "next/server";

import { getAuthenticatedAdminMfaContext } from "@/lib/supabase/admin-auth.server";

export async function GET() {
  const context = await getAuthenticatedAdminMfaContext();

  if (!context.ok) {
    return NextResponse.json(
      { error: context.error },
      { status: context.status },
    );
  }

  return NextResponse.json({
    currentLevel: context.currentLevel,
    hasVerifiedTotp: context.verifiedTotpFactors.length > 0,
    hasPendingTotp: context.pendingTotpFactors.length > 0,
    verifiedTotpFactorId: context.verifiedTotpFactors[0]?.id ?? null,
    pendingTotpFactorId: context.pendingTotpFactors[0]?.id ?? null,
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
