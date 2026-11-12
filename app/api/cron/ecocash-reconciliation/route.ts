
import {
  isAuthorizedCronRequest,
} from "@/lib/server/cron-auth.server";

import {
  createEcoCashReconciliationWorker,
} from "@/lib/server/ecocash-reconciliation-worker.server";

import {
  createEcoCashPaymentReconciliationRepository,
} from "@/lib/server/ecocash-payment-repository.server";

import {
  getEcoCashConfig,
  lookupEcoCashCharge,
} from "@/lib/server/ecocash-provider.server";

import {
  createAdminSupabaseClient,
} from "@/lib/supabase/admin.server";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(
    request,
    process.env.CRON_SECRET,
  )) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    getEcoCashConfig();

    const worker = createEcoCashReconciliationWorker({
      createRepository: () =>
        createEcoCashPaymentReconciliationRepository(
          createAdminSupabaseClient(),
        ),

      lookupCharge: lookupEcoCashCharge,
      now: () => new Date().toISOString(),
      limit: 6,
    });

    const summary = await worker();

    return Response.json({
      success: true,
      ...summary,
    });
  } catch {
    return Response.json(
      { error: "EcoCash reconciliation failed." },
      { status: 500 },
    );
  }
}
