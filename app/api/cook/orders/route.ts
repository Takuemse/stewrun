import {
  handleCookOrdersGet,
} from "@/lib/cook-orders-handler";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

export async function GET(): Promise<Response> {
  let clientPromise: ReturnType<typeof createServerSupabaseClient> | undefined;
  const getClient = () => {
    clientPromise ??= createServerSupabaseClient();
    return clientPromise;
  };

  return handleCookOrdersGet({
    authenticate: getAuthenticatedUser,

    isApprovedCook: async (userId) => {
      const supabase = await getClient();
      const { data, error } = await supabase
        .from("cook_profiles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("status", "approved")
        .maybeSingle();

      return {
        approved: data !== null,
        error: error ? { message: error.message } : null,
      };
    },

    listOrders: async () => {
      const supabase = await getClient();
      const { data, error } = await supabase.rpc("get_cook_orders");

      return {
        data,
        error: error ? { message: error.message } : null,
      };
    },
  });
}
