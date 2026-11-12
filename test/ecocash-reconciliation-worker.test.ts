
import * as mocha from "mocha";
import assert from "node:assert";

import {
  createEcoCashReconciliationWorker,
} from "../lib/server/ecocash-reconciliation-worker.server";

import type {
  PaymentReconciliationRepository,
  UnresolvedEcoCashPaymentAttempt,
} from "../lib/server/ecocash-payment-types";

import type {
  EcoCashReconciliationWorkerDependencies,
} from "../lib/server/ecocash-reconciliation-worker.server";

const { describe, it } = mocha;

const attempts: UnresolvedEcoCashPaymentAttempt[] = [
  {
    id: "payment-1",
    client_correlator: "correlator-1",
    reference_code: "reference-1",
    end_user_id: "+263771234567",
    status: "pending",
  },
];

function createRepository(
  overrides: Partial<PaymentReconciliationRepository> = {},
): PaymentReconciliationRepository {
  return {
    listUnresolvedAttempts: async () => ({
      data: attempts,
      error: null,
    }),

    recordUncertainLookup: async () => ({
      data: { id: "payment-1" },
      error: null,
    }),

    reconcileVerifiedSuccess: async () => ({
      data: "order_confirmed",
      error: null,
    }),

    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<EcoCashReconciliationWorkerDependencies> = {},
): EcoCashReconciliationWorkerDependencies {
  return {
    createRepository: () => createRepository(),

    lookupCharge: async () => ({
      outcome: "verified_success",
      providerStatus: "Charged",
      responseCode: "00",
      providerReference: "ECO-TEST-001",
    }),

    now: () => "2026-11-12T11:00:00.000Z",

    ...overrides,
  };
}

describe("EcoCash reconciliation worker", () => {
  it("confirms an order after verified EcoCash success", async () => {
    let reconciled = false;

    const repository = createRepository({
      reconcileVerifiedSuccess: async () => {
        reconciled = true;

        return {
          data: "order_confirmed",
          error: null,
        };
      },
    });

    const worker = createEcoCashReconciliationWorker(
      createDependencies({
        createRepository: () => repository,
      }),
    );

    const result = await worker();

    assert.strictEqual(reconciled, true);
    assert.strictEqual(result.checked, 1);
    assert.strictEqual(result.confirmed, 1);
    assert.strictEqual(result.errors, 0);
  });

  it("records uncertain lookup results without confirming payment", async () => {
    let recorded = false;
    let reconciled = false;

    const repository = createRepository({
      recordUncertainLookup: async () => {
        recorded = true;

        return {
          data: { id: "payment-1" },
          error: null,
        };
      },

      reconcileVerifiedSuccess: async () => {
        reconciled = true;

        return {
          data: "order_confirmed",
          error: null,
        };
      },
    });

    const worker = createEcoCashReconciliationWorker(
      createDependencies({
        createRepository: () => repository,

        lookupCharge: async () => ({
          outcome: "uncertain",
          reason: "Provider response could not be verified.",
        }),
      }),
    );

    const result = await worker();

    assert.strictEqual(recorded, true);
    assert.strictEqual(reconciled, false);
    assert.strictEqual(result.uncertain, 1);
    assert.strictEqual(result.confirmed, 0);
  });

  it("counts verified payments requiring manual review", async () => {
    const worker = createEcoCashReconciliationWorker(
      createDependencies({
        createRepository: () =>
          createRepository({
            reconcileVerifiedSuccess: async () => ({
              data: "manual_review_required",
              error: null,
            }),
          }),
      }),
    );

    const result = await worker();

    assert.strictEqual(result.manualReview, 1);
    assert.strictEqual(result.confirmed, 0);
  });

  it("counts payments already processed by reconciliation", async () => {
    const worker = createEcoCashReconciliationWorker(
      createDependencies({
        createRepository: () =>
          createRepository({
            reconcileVerifiedSuccess: async () => ({
              data: "already_processed",
              error: null,
            }),
          }),
      }),
    );

    const result = await worker();

    assert.strictEqual(result.alreadyProcessed, 1);
  });

  it("does not fail the entire batch when one provider lookup throws", async () => {
    const worker = createEcoCashReconciliationWorker(
      createDependencies({
        createRepository: () =>
          createRepository({
            listUnresolvedAttempts: async () => ({
              data: [
                attempts[0],
                {
                  ...attempts[0],
                  id: "payment-2",
                  client_correlator: "correlator-2",
                },
              ],
              error: null,
            }),
          }),

        lookupCharge: async ({ clientCorrelator }) => {
          if (clientCorrelator === "correlator-1") {
            throw new Error("Provider unavailable");
          }

          return {
            outcome: "verified_success",
            providerStatus: "Charged",
            responseCode: "00",
            providerReference: "ECO-TEST-002",
          };
        },
      }),
    );

    const result = await worker();

    assert.strictEqual(result.checked, 2);
    assert.strictEqual(result.errors, 1);
    assert.strictEqual(result.confirmed, 1);
  });

  it("throws when unresolved attempts cannot be retrieved", async () => {
    const worker = createEcoCashReconciliationWorker(
      createDependencies({
        createRepository: () =>
          createRepository({
            listUnresolvedAttempts: async () => ({
              data: null,
              error: {
                message: "Database unavailable",
              },
            }),
          }),
      }),
    );

    await assert.rejects(
      () => worker(),
      /Unable to retrieve unresolved EcoCash payments/,
    );
  });

  it("counts an attempt as skipped when its record changes before update", async () => {
    const worker = createEcoCashReconciliationWorker(
      createDependencies({
        createRepository: () =>
          createRepository({
            recordUncertainLookup: async () => ({
              data: null,
              error: null,
            }),
          }),

        lookupCharge: async () => ({
          outcome: "uncertain",
          reason: "Provider response is pending.",
        }),
      }),
    );

    const result = await worker();

    assert.strictEqual(result.skipped, 1);
    assert.strictEqual(result.uncertain, 0);
  });
});
