
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
    "ready",
    {
      authenticate: getAuthenticatedUser,

      markOrderReady: async (orderId) => {
        const supabase = await createServerSupabaseClient();

        const { data, error } = await supabase.rpc(
          "mark_order_ready",
          {
            p_order_id: orderId,
          },
        );

        if (error) {
          console.error("Mark order ready RPC failed:", {
            code: error.code,
            message: error.message,
          });
        }

        return {
          data: typeof data === "string" ? data : null,
          error: error ? { message: error.message } : null,
        };
      },

      confirmOrderCollection: async () => ({
        data: null,
        error: { message: "Unused transition." },
      }),
    },
  );
}
