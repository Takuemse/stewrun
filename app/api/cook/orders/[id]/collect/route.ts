
import {
  handleCookOrderTransition,
} from "@/lib/cook-order-transition-handler";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { id } = await params;

  return handleCookOrderTransition(
    request,
    id,
    "collect",
    {
      authenticate: getAuthenticatedUser,

      markOrderReady: async () => ({
        data: null,
        error: { message: "Unused transition." },
      }),

      confirmOrderCollection: async (orderId, pickupCode) => {
        const supabase = await createServerSupabaseClient();

        const { data, error } = await supabase.rpc(
          "confirm_order_collection",
          {
            p_order_id: orderId,
            p_pickup_code: pickupCode,
          },
        );

        if (error) {
          console.error("Confirm order collection RPC failed:", {
            code: error.code,
            message: error.message,
          });
        }

        return {
          data: typeof data === "string" ? data : null,
          error: error ? { message: error.message } : null,
        };
      },
    },
  );
}
