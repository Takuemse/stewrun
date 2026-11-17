import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/auth.server";

function getSignupSuccessUrl(request: Request, confirmed: boolean) {
  const target = new URL("/signup-success", request.url);
  target.searchParams.set("confirmed", confirmed ? "true" : "false");
  return target;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(getSignupSuccessUrl(request, false));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(getSignupSuccessUrl(request, false));
  }

  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(getSignupSuccessUrl(request, true));
}
