
import type {
  PaymentReconciliationRepository,
  UnresolvedEcoCashPaymentAttempt,
} from "./ecocash-payment-types";

import type {
  EcoCashLookupResult,
} from "./ecocash-provider.server";

export interface EcoCashReconciliationWorkerDependencies {
  createRepository: () => PaymentReconciliationRepository;

  lookupCharge: (input: {
    clientCorrelator: string;
    referenceCode: string;
    endUserId: string;
  }) => Promise<EcoCashLookupResult>;

  now: () => string;

  limit?: number;
}

export interface EcoCashReconciliationSummary {
  checked: number;
  confirmed: number;
  manualReview: number;
  alreadyProcessed: number;
  uncertain: number;
  skipped: number;
  errors: number;
}

type AttemptOutcome =
  | "confirmed"
  | "manualReview"
  | "alreadyProcessed"
  | "uncertain"
  | "skipped"
  | "error";

async function reconcileAttempt(
  attempt: UnresolvedEcoCashPaymentAttempt,
  repository: PaymentReconciliationRepository,
  dependencies: EcoCashReconciliationWorkerDependencies,
): Promise<AttemptOutcome> {
  try {
    const lookup = await dependencies.lookupCharge({
      clientCorrelator: attempt.client_correlator,
      referenceCode: attempt.reference_code,
      endUserId: attempt.end_user_id,
    });

    if (lookup.outcome === "uncertain") {
      const recorded = await repository.recordUncertainLookup(
        attempt.id,
        lookup.reason,
        dependencies.now(),
      );

      if (recorded.error) {
        return "error";
      }

      return recorded.data ? "uncertain" : "skipped";
    }

    const reconciled = await repository.reconcileVerifiedSuccess({
      paymentTransactionId: attempt.id,
      providerStatus: lookup.providerStatus,
      responseCode: lookup.responseCode,
      providerReference: lookup.providerReference,
    });

    if (reconciled.error || !reconciled.data) {
      return "error";
    }

    switch (reconciled.data) {
      case "order_confirmed":
        return "confirmed";

      case "manual_review_required":
        return "manualReview";

      case "already_processed":
        return "alreadyProcessed";

      default:
        return "error";
    }
  } catch {
    return "error";
  }
}

export function createEcoCashReconciliationWorker(
  dependencies: EcoCashReconciliationWorkerDependencies,
) {
  return async (): Promise<EcoCashReconciliationSummary> => {
    const repository = dependencies.createRepository();
    const limit = dependencies.limit ?? 6;

    const result = await repository.listUnresolvedAttempts(limit);

    if (result.error || !result.data) {
      throw new Error(
        "Unable to retrieve unresolved EcoCash payments.",
      );
    }

    const summary: EcoCashReconciliationSummary = {
      checked: result.data.length,
      confirmed: 0,
      manualReview: 0,
      alreadyProcessed: 0,
      uncertain: 0,
      skipped: 0,
      errors: 0,
    };

    // Process at most three provider lookups concurrently.
    for (let index = 0; index < result.data.length; index += 3) {
      const batch = result.data.slice(index, index + 3);

      const outcomes = await Promise.all(
        batch.map((attempt) =>
          reconcileAttempt(attempt, repository, dependencies),
        ),
      );

      for (const outcome of outcomes) {
        if (outcome === "error") {
          summary.errors += 1;
        } else {
          summary[outcome] += 1;
        }
      }
    }

    return summary;
  };
}
