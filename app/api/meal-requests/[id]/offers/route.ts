
import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  // 1. Authenticate the user.
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  // 2. Only customers may review offers.
  if (auth.role !== "customer") {
    return NextResponse.json(
      { error: "Customer access required." },
      { status: 403 },
    );
  }

  // 3. Validate the request ID.
  const { id: requestId } = await context.params;

  if (!UUID_REGEX.test(requestId)) {
    return NextResponse.json(
      { error: "Invalid meal request ID." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();

  // 4. Verify that this meal request belongs to the customer.
  const { data: mealRequest, error: requestError } =
    await supabase
      .from("meal_requests")
      .select("id")
      .eq("id", requestId)
      .eq("customer_id", auth.user.id)
      .maybeSingle();

  if (requestError) {
    console.error("Meal request ownership lookup failed:", {
      message: requestError.message,
      code: requestError.code,
    });

    return NextResponse.json(
      { error: "Unable to retrieve meal request." },
      { status: 500 },
    );
  }

  if (!mealRequest) {
    return NextResponse.json(
      { error: "Meal request not found." },
      { status: 404 },
    );
  }

  // 5. Retrieve submitted offers for this request.
  const { data: offers, error: offersError } = await supabase
    .from("cook_offers")
    .select(
      `
        id,
        cook_id,
        message,
        total_price,
        created_at,
        submitted_at
      `,
    )
    .eq("request_id", requestId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true });

  if (offersError) {
    console.error("Customer offer lookup failed:", {
      message: offersError.message,
      code: offersError.code,
    });

    return NextResponse.json(
      { error: "Unable to retrieve cook offers." },
      { status: 500 },
    );
  }

  // 6. Return an empty result when no submitted offers exist.
  if (!offers || offers.length === 0) {
    return NextResponse.json(
      {
        offers: [],
        negotiation: null,
      },
      { status: 200 },
    );
  }

  const offerIds = offers.map((offer) => offer.id);
  const cookIds = [...new Set(offers.map((offer) => offer.cook_id))];

  // 7. Retrieve offer items, approved cook profiles and
  //    this customer's negotiation for the request.
  const [
    { data: offerItems, error: itemsError },
    { data: cookProfiles, error: profilesError },
    { data: negotiation, error: negotiationError },
  ] = await Promise.all([
    supabase
      .from("cook_offer_items")
      .select(
        `
          id,
          offer_id,
          name,
          description,
          quantity,
          unit_price,
          line_total
        `,
      )
      .in("offer_id", offerIds),

    supabase
      .from("cook_profiles")
      .select("user_id, display_name, bio")
      .in("user_id", cookIds)
      .eq("status", "approved"),

    supabase
      .from("negotiations")
      .select(
        `
          id,
          offer_id,
          proposed_total,
          message,
          status,
          created_at,
          responded_at,
          agreed_total
        `,
      )
      .eq("request_id", requestId)
      .eq("customer_id", auth.user.id)
      .maybeSingle(),
  ]);

  if (itemsError) {
    console.error("Offer item lookup failed:", {
      message: itemsError.message,
      code: itemsError.code,
    });

    return NextResponse.json(
      { error: "Unable to retrieve offer details." },
      { status: 500 },
    );
  }

  if (profilesError) {
    console.error("Cook profile lookup failed:", {
      message: profilesError.message,
      code: profilesError.code,
    });

    return NextResponse.json(
      { error: "Unable to retrieve cook information." },
      { status: 500 },
    );
  }

  if (negotiationError) {
    console.error("Negotiation lookup failed:", {
      message: negotiationError.message,
      code: negotiationError.code,
    });

    return NextResponse.json(
      { error: "Unable to retrieve negotiation information." },
      { status: 500 },
    );
  }

  // 8. Group offer items and cook profiles by their IDs.
  const itemsByOffer = new Map<
    string,
    NonNullable<typeof offerItems>
  >();

  for (const item of offerItems ?? []) {
    const existingItems = itemsByOffer.get(item.offer_id) ?? [];
    existingItems.push(item);
    itemsByOffer.set(item.offer_id, existingItems);
  }

  const profilesByCook = new Map(
    (cookProfiles ?? []).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );

  // 9. Build the customer-facing response.
  const customerOffers = offers.map((offer) => {
    const cook = profilesByCook.get(offer.cook_id);

    return {
      id: offer.id,
      message: offer.message,
      total_price: offer.total_price,
      created_at: offer.created_at,
      submitted_at: offer.submitted_at,
      cook: cook
        ? {
            display_name: cook.display_name,
            bio: cook.bio,
          }
        : null,
      items: itemsByOffer.get(offer.id) ?? [],
    };
  });

  return NextResponse.json(
    {
      offers: customerOffers,
      negotiation: negotiation ?? null,
    },
    { status: 200 },
  );
}
