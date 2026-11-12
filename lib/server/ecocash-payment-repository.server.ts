
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreatePaymentAttemptInput,
  PaymentAttemptUpdate,
  PaymentReconciliationRepository,
  PaymentRepository,
} from "./ecocash-payment-types";

export function createEcoCashPaymentRepository(
  admin: SupabaseClient,
): PaymentRepository {
  return {
    async createAttempt(input: CreatePaymentAttemptInput) {
      const result = await admin.rpc(
        "create_ecocash_payment_attempt",
        {
          p_order_id: input.orderId,
          p_customer_id: input.customerId,
          p_end_user_id: input.phoneNumber,
          p_client_correlator: input.clientCorrelator,
          p_reference_code: input.referenceCode,
        },
      );

      return {
        data: result.data,
        error: result.error,
      };
    },

    async updateAttempt(
      paymentTransactionId: string,
      update: PaymentAttemptUpdate,
    ) {
      const result = await admin
        .from("payment_transactions")
        .update(update)
        .eq("id", paymentTransactionId)
        .eq("status", "initiated")
        .select("id")
        .maybeSingle();

      return {
        data: result.data,
        error: result.error,
      };
    },
  };
}

export function createEcoCashPaymentReconciliationRepository(
  admin: SupabaseClient,
): PaymentReconciliationRepository {
  return {
    async listUnresolvedAttempts(limit: number) {
      const result = await admin
        .from("payment_transactions")
        .select(
          "id, client_correlator, reference_code, end_user_id, status",
        )
        .eq("provider", "ecocash")
        .in("status", [
          "initiated",
          "pending",
          "reconciliation_required",
        ])
        .order("created_at", { ascending: true })
        .limit(limit);

      return {
        data: result.data,
        error: result.error,
      };
    },

    async recordUncertainLookup(
      paymentTransactionId: string,
      reason: string,
      checkedAt: string,
    ) {
      const result = await admin
        .from("payment_transactions")
        .update({
          last_checked_at: checkedAt,
          failure_reason: reason,
          updated_at: checkedAt,
        })
        .eq("id", paymentTransactionId)
        .in("status", [
          "initiated",
          "pending",
          "reconciliation_required",
        ])
        .select("id")
        .maybeSingle();

      return {
        data: result.data,
        error: result.error,
      };
    },

    async reconcileVerifiedSuccess(input) {
      const result = await admin.rpc(
        "reconcile_ecocash_payment_success",
        {
          p_payment_transaction_id: input.paymentTransactionId,
          p_provider_status: input.providerStatus,
          p_response_code: input.responseCode,
          p_provider_reference: input.providerReference,
        },
      );

      return {
        data: result.data,
        error: result.error,
      };
    },
  };
}
