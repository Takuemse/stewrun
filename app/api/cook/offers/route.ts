
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

import {
  handleCookOffersGet,
  handleCookOffersPost,
  type CookOffersDependencies,
} from "@/lib/cook-offers-handler";

function createDependencies(): CookOffersDependencies {
  let supabasePromise: ReturnType<typeof createServerSupabaseClient> | null =
    null;

  function getSupabase() {
    supabasePromise ??= createServerSupabaseClient();
    return supabasePromise;
  }

  return {
    authenticate: getAuthenticatedUser,

    getCookProfile: async (userId) => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("cook_profiles")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle();

      return {
        data: data as { status: string } | null,
        error,
      };
    },

    listOffers: async (userId) => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("cook_offers")
        .select("id, request_id, total_price, submitted_at")
        .eq("cook_id", userId)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true });

      return {
        data: data as {
          id: string;
          request_id: string;
          total_price: number;
          submitted_at: string;
        }[] | null,
        error,
      };
    },

    listOfferItems: async (offerIds) => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("cook_offer_items")
        .select("offer_id, name, description, quantity, unit_price, line_total")
        .in("offer_id", offerIds);

      return {
        data: data as {
          offer_id: string;
          name: string;
          description: string | null;
          quantity: number;
          unit_price: number;
          line_total: number;
        }[] | null,
        error,
      };
    },

    listRequests: async (requestIds) => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("meal_requests")
        .select("id, items, hub, pickup_date, pickup_time")
        .in("id", requestIds);

      return {
        data: data as {
          id: string;
          items: unknown;
          hub: string;
          pickup_date: string;
          pickup_time: string;
        }[] | null,
        error,
      };
    },

    getCookOfferProfile: async (userId) => {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from("cook_profiles")
        .select("status, is_available")
        .eq("user_id", userId)
        .maybeSingle();

      return {
        data: data as {
          status: string;
          is_available: boolean;
        } | null,
        error,
      };
    },

    submitOffer: async (functionName, parameters) => {
      const supabase = await getSupabase();
      const { data, error } = await supabase.rpc(
        functionName,
        parameters as never,
      );

      return { data, error };
    },
  };
}

export async function GET(): Promise<Response> {
  return handleCookOffersGet(createDependencies());
}

export async function POST(request: Request): Promise<Response> {
  return handleCookOffersPost(request, createDependencies());
}
