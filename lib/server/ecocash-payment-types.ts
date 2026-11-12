
export interface CreatePaymentAttemptInput {
  orderId: string;
  customerId: string;
  phoneNumber: string;
  clientCorrelator: string;
  referenceCode: string;
}

export type PaymentAttemptUpdate =
  | {
      status: "pending";
      provider_status: string;
      response_code: string;
      provider_reference: string | null;
      updated_at: string;
    }
  | {
      status: "reconciliation_required";
      failure_reason: string;
      updated_at: string;
    };

export interface PaymentRepositoryResult<T> {
  data: T | null;
  error: {
    code?: string;
    message?: string;
  } | null;
}

export interface PaymentRepository {
  createAttempt(
    input: CreatePaymentAttemptInput,
  ): Promise<PaymentRepositoryResult<unknown>>;

  updateAttempt(
    paymentTransactionId: string,
    update: PaymentAttemptUpdate,
  ): Promise<PaymentRepositoryResult<{ id: string }>>;
}

export type UnresolvedEcoCashPaymentAttempt = {
  id: string;
  client_correlator: string;
  reference_code: string;
  end_user_id: string;
  status: "initiated" | "pending" | "reconciliation_required";
};

export type EcoCashReconciliationResult =
  | "order_confirmed"
  | "manual_review_required"
  | "already_processed";

export interface PaymentReconciliationRepository {
  listUnresolvedAttempts(
    limit: number,
  ): Promise<PaymentRepositoryResult<UnresolvedEcoCashPaymentAttempt[]>>;

  recordUncertainLookup(
    paymentTransactionId: string,
    reason: string,
    checkedAt: string,
  ): Promise<PaymentRepositoryResult<{ id: string }>>;

  reconcileVerifiedSuccess(input: {
    paymentTransactionId: string;
    providerStatus: "Charged";
    responseCode: "00";
    providerReference: string | null;
  }): Promise<PaymentRepositoryResult<EcoCashReconciliationResult>>;
}
