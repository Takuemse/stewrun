
import { NextResponse } from "next/server";
import { readRequestBody } from "@/lib/request-body";
import { normalizeZimbabweEcoCashPhoneNumber } from "@/lib/ecocash-payment-client";
import type {
  EcoCashPaymentHandler,
  EcoCashPaymentHandlerDependencies,
} from "./ecocash-payment-handler.types";

type PaymentAttempt = {
  payment_transaction_id: string;
  client_correlator: string;
  reference_code: string;
  end_user_id: string;
  amount: string | number;
  currency: string;
  expires_at: string;
};

function isPaymentAttempt(value: unknown): value is PaymentAttempt {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const attempt = value as Record<string, unknown>;

  return (
    typeof attempt.payment_transaction_id === "string" &&
    typeof attempt.client_correlator === "string" &&
    typeof attempt.reference_code === "string" &&
    typeof attempt.end_user_id === "string" &&
    (typeof attempt.amount === "string" || typeof attempt.amount === "number") &&
    typeof attempt.currency === "string" &&
    typeof attempt.expires_at === "string"
  );
}

function uncertainPaymentResponse(error: string) {
  return NextResponse.json(
    {
      code: "PAYMENT_STATUS_UNCERTAIN",
      error,
    },
    { status: 503 },
  );
}

function getRpcErrorResponse(error: {
  code?: string;
  message?: string;
}) {
  if (error.code === "42501") {
    return NextResponse.json(
      { error: "Order not found or unavailable." },
      { status: 404 },
    );
  }

  if (error.code === "23505") {
    return NextResponse.json(
      { error: "A payment attempt is already active for this order." },
      { status: 409 },
    );
  }

  const message = error.message?.toLowerCase() ?? "";

  if (
    message.includes("unresolved") ||
    message.includes("not eligible") ||
    message.includes("reservation expired") ||
    message.includes("association changed")
  ) {
    return NextResponse.json(
      { error: "This order is not currently eligible for payment." },
      { status: 409 },
    );
  }

  if (
    message.includes("order not found") ||
    message.includes("associated meal request not found")
  ) {
    return NextResponse.json(
      { error: "Order not found or unavailable." },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { error: "Unable to create a payment attempt." },
    { status: 500 },
  );
}

export function createEcoCashPaymentHandler(
  dependencies: EcoCashPaymentHandlerDependencies,
): EcoCashPaymentHandler {
  return async ({ request, orderId }) => {
    let auth;

    try {
      auth = await dependencies.authenticate();
    } catch {
      console.error("Payment route authentication failed unexpectedly.");

      return NextResponse.json(
        { error: "Unable to verify authentication." },
        { status: 500 },
      );
    }

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    if (auth.role !== "customer") {
      return NextResponse.json(
        { error: "Only customers can initiate order payments." },
        { status: 403 },
      );
    }

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(orderId)) {
      return NextResponse.json(
        { error: "Invalid order ID." },
        { status: 400 },
      );
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json." },
        { status: 415 },
      );
    }

    const bodyResult = await readRequestBody(request, 2048);

    if (!bodyResult.ok && bodyResult.reason === "too_large") {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 },
      );
    }

    if (!bodyResult.ok) {
      return NextResponse.json(
        { error: "Unable to read request body." },
        { status: 400 },
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(bodyResult.text);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      typeof (body as Record<string, unknown>).phoneNumber !== "string"
    ) {
      return NextResponse.json(
        { error: "A valid phoneNumber is required." },
        { status: 400 },
      );
    }

    const phoneNumber = normalizeZimbabweEcoCashPhoneNumber(
      (body as { phoneNumber: string }).phoneNumber,
    );

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Enter a valid Zimbabwean EcoCash number." },
        { status: 400 },
      );
    }

    try {
      dependencies.ensureProviderConfigured();
    } catch {
      return NextResponse.json(
        { error: "EcoCash payment service is not configured." },
        { status: 503 },
      );
    }

    let repository;

    try {
      repository = dependencies.createRepository();
    } catch {
      return NextResponse.json(
        { error: "Payment service is temporarily unavailable." },
        { status: 503 },
      );
    }

    let attemptResult;

    try {
      attemptResult = await repository.createAttempt({
        orderId,
        customerId: auth.user.id,
        phoneNumber,
        clientCorrelator: dependencies.createId(),
        referenceCode: dependencies.createId(),
      });
    } catch {
      console.error("EcoCash attempt RPC request failed unexpectedly.");

      return uncertainPaymentResponse(
        "Payment attempt status is unknown. Do not retry this payment. Contact support.",
      );
    }

    if (attemptResult.error) {
      console.error(
        "EcoCash attempt creation failed:",
        attemptResult.error.code,
      );

      return getRpcErrorResponse(attemptResult.error);
    }

    const attemptRow = Array.isArray(attemptResult.data)
      ? attemptResult.data[0]
      : null;

    if (!isPaymentAttempt(attemptRow)) {
      console.error("EcoCash attempt RPC returned an invalid result.");

      return uncertainPaymentResponse(
        "Payment attempt status could not be confirmed. Do not retry this payment. Contact support.",
      );
    }

    const amount = Number(attemptRow.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      attemptRow.currency !== "USD"
    ) {
      console.error("EcoCash attempt contains invalid payment details.");

      return uncertainPaymentResponse(
        "Payment details could not be confirmed. Do not retry this payment. Contact support.",
      );
    }

    let providerResult;

    try {
      providerResult = await dependencies.initiateCharge({
        clientCorrelator: attemptRow.client_correlator,
        referenceCode: attemptRow.reference_code,
        endUserId: attemptRow.end_user_id,
        amount: attemptRow.amount,
        currency: attemptRow.currency,
      });
    } catch {
      providerResult = {
        outcome: "uncertain" as const,
        reason: "The provider response could not be safely determined.",
      };
    }

    const paymentUpdate =
      providerResult.outcome === "acknowledged"
        ? {
            status: "pending" as const,
            provider_status: providerResult.providerStatus,
            response_code: providerResult.responseCode,
            provider_reference: providerResult.providerReference,
            updated_at: dependencies.now(),
          }
        : {
            status: "reconciliation_required" as const,
            failure_reason: providerResult.reason,
            updated_at: dependencies.now(),
          };

    let updatedAttempt;

    try {
      updatedAttempt = await repository.updateAttempt(
        attemptRow.payment_transaction_id,
        paymentUpdate,
      );
    } catch {
      console.error("EcoCash attempt status update threw unexpectedly.");

      return uncertainPaymentResponse(
        "Payment status could not be confirmed. Do not retry this payment. Contact support.",
      );
    }

    if (updatedAttempt.error || !updatedAttempt.data) {
      console.error(
        "EcoCash attempt status update failed:",
        updatedAttempt.error?.code ?? "no_row_updated",
      );

      return uncertainPaymentResponse(
        "Payment status could not be confirmed. Do not retry this payment. Contact support.",
      );
    }

    if (providerResult.outcome === "uncertain") {
      return uncertainPaymentResponse(
        "EcoCash could not confirm the payment request. Do not retry. The transaction requires reconciliation.",
      );
    }

    return NextResponse.json(
      {
        payment_attempt: {
          amount,
          currency: attemptRow.currency,
        },
      },
      { status: 202 },
    );
  };
}
