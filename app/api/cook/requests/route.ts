
import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

const TIME_ZONE = "Africa/Harare";

function getHarareLocalTimestamp(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}

function isPickupStillUpcoming(request: {
  pickup_date: string | null;
  pickup_time: string | null;
}): boolean {
  const { pickup_date, pickup_time } = request;

  if (
    !pickup_date ||
    !pickup_time ||
    !/^\d{4}-\d{2}-\d{2}$/.test(pickup_date) ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(pickup_time)
  ) {
    return false;
  }

  const normalizedTime =
    pickup_time.length === 5 ? `${pickup_time}:00` : pickup_time;

  const pickupDateTime = `${pickup_date}T${normalizedTime}`;

  return pickupDateTime > getHarareLocalTimestamp();
}

export async function GET() {
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  if (auth.role !== "cook") {
    return NextResponse.json(
      { error: "Cook access required." },
      { status: 403 },
    );
  }

  const supabase = await createServerSupabaseClient();

  const { data: cookProfile, error: profileError } = await supabase
    .from("cook_profiles")
    .select("status")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Cook profile lookup failed:", profileError);

    return NextResponse.json(
      { error: "Unable to verify cook approval." },
      { status: 500 },
    );
  }

  if (!cookProfile || cookProfile.status !== "approved") {
    return NextResponse.json(
      { error: "An approved cook account is required." },
      { status: 403 },
    );
  }

  const nowIso = new Date().toISOString();

  const { data: requests, error: requestsError } = await supabase
    .from("meal_requests")
    .select(
      `
        id,
        items,
        budget,
        hub,
        pickup_date,
        pickup_time,
        notes,
        created_at,
        offers_close_at
      `,
    )
    .eq("status", "open")
    .gt("offers_close_at", nowIso)
    .order("pickup_date", { ascending: true })
    .order("pickup_time", { ascending: true });

  if (requestsError) {
    console.error("Meal request lookup failed:", requestsError);

    return NextResponse.json(
      { error: "Unable to retrieve meal requests." },
      { status: 500 },
    );
  }

  const availableRequests = (requests ?? []).filter(
    isPickupStillUpcoming,
  );

  return NextResponse.json(
    { requests: availableRequests },
    { status: 200 },
  );
}
