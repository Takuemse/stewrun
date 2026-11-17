import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (auth.role !== "cook") {
    return NextResponse.json(
      { error: "Cook access required." },
      { status: 403 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("cook_profiles")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .eq("status", "approved")
    .maybeSingle();

  if (profileError) {
    console.error("Cook approval lookup failed:", {
      code: profileError.code,
      message: profileError.message,
    });
    return NextResponse.json(
      { error: "Unable to verify cook permissions." },
      { status: 500 },
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "An approved cook account is required." },
      { status: 403 },
    );
  }

  const { data: negotiations, error: negotiationError } = await supabase
    .from("negotiations")
    .select(
      "id, offer_id, request_id, proposed_total, message, created_at",
    )
    .eq("cook_id", auth.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (negotiationError) {
    console.error("Cook negotiation lookup failed:", {
      code: negotiationError.code,
      message: negotiationError.message,
    });
    return NextResponse.json(
      { error: "Unable to load counter-offers." },
      { status: 500 },
    );
  }

  if (!negotiations?.length) {
    return NextResponse.json({ negotiations: [] });
  }

  const requestIds = [...new Set(negotiations.map((item) => item.request_id))];
  const offerIds = [...new Set(negotiations.map((item) => item.offer_id))];
  const [
    { data: requests, error: requestsError },
    { data: offers, error: offersError },
  ] = await Promise.all([
    supabase
      .from("meal_requests")
      .select("id, items, hub, pickup_date, pickup_time, notes")
      .in("id", requestIds),
    supabase
      .from("cook_offers")
      .select("id, total_price")
      .in("id", offerIds)
      .eq("cook_id", auth.user.id),
  ]);

  if (requestsError || offersError) {
    const error = requestsError ?? offersError;
    console.error("Cook negotiation context lookup failed:", {
      code: error?.code,
      message: error?.message,
    });
    return NextResponse.json(
      { error: "Unable to load counter-offer details." },
      { status: 500 },
    );
  }

  const requestsById = new Map((requests ?? []).map((item) => [item.id, item]));
  const offersById = new Map((offers ?? []).map((item) => [item.id, item]));

  return NextResponse.json({
    negotiations: negotiations.map((negotiation) => ({
      id: negotiation.id,
      proposed_total: negotiation.proposed_total,
      message: negotiation.message,
      created_at: negotiation.created_at,
      request: requestsById.get(negotiation.request_id) ?? null,
      offer: offersById.get(negotiation.offer_id) ?? null,
    })),
  });
}
