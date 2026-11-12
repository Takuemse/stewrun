
import { randomUUID } from "node:crypto";
import { createEcoCashPaymentHandler } from "@/lib/server/ecocash-payment-handler.server";
import { createEcoCashPaymentRepository } from "@/lib/server/ecocash-payment-repository.server";
import { getEcoCashConfig, initiateEcoCashCharge } from "@/lib/server/ecocash-provider.server";
import { getAuthenticatedUser } from "@/lib/supabase/auth.server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin.server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const paymentHandler = createEcoCashPaymentHandler({
  authenticate: getAuthenticatedUser,

  createRepository: () => {
    const admin = createAdminSupabaseClient();
    return createEcoCashPaymentRepository(admin);
  },

  ensureProviderConfigured: () => {
    getEcoCashConfig();
  },

  initiateCharge: initiateEcoCashCharge,

  createId: randomUUID,

  now: () => new Date().toISOString(),
});

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  const { id } = await params;

  return paymentHandler({
    request,
    orderId: id,
  });
}
