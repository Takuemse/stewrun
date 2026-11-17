import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/auth.server";

export async function GET() {
  const supabase = await createServerSupabaseClient();

  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select("id, cook_id, name, description, price")
    .eq("available", true)
    .order("name", { ascending: true });

  if (menuError) {
    console.error("Public menu lookup failed:", {
      code: menuError.code,
      message: menuError.message,
    });
    return NextResponse.json(
      { error: "Unable to load food offerings." },
      { status: 500 },
    );
  }

  if (!menuItems?.length) {
    return NextResponse.json({ menu: [] });
  }

  const cookIds = [...new Set(menuItems.map((item) => item.cook_id))];
  const { data: profiles, error: profileError } = await supabase
    .from("cook_profiles")
    .select("user_id, display_name, bio, supported_hubs")
    .in("user_id", cookIds)
    .eq("status", "approved");

  if (profileError) {
    console.error("Public cook profile lookup failed:", {
      code: profileError.code,
      message: profileError.message,
    });
    return NextResponse.json(
      { error: "Unable to load cook information." },
      { status: 500 },
    );
  }

  const profilesByCook = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile]),
  );

  const { data: ratingRows, error: ratingError } = await supabase.rpc(
    "get_public_cook_rating_summaries",
  );
  if (ratingError) {
    // Keep browsing available until the ratings schema is installed.
    console.warn("Public cook ratings are not available yet.");
  }
  const summaries = (ratingRows ?? []) as {
    cook_id: string;
    average_stars: number | string;
    rating_count: number | string;
  }[];
  const ratingsByCook = new Map(
    summaries.map((rating) => [rating.cook_id, {
      average_stars: Number(rating.average_stars),
      rating_count: Number(rating.rating_count),
    }]),
  );

  const offerings = menuItems.flatMap((item) => {
    const cook = profilesByCook.get(item.cook_id);

    if (!cook) {
      return [];
    }

    return [{
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      cook: {
        display_name: cook.display_name,
        bio: cook.bio,
        supported_hubs: cook.supported_hubs,
        rating: ratingsByCook.get(item.cook_id) ?? null,
      },
    }];
  });

  return NextResponse.json({ menu: offerings });
}
