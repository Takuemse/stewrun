export type NegotiationDecision = "accepted" | "rejected";

export type ValidatedNegotiationResponse = {
  negotiation_id: string;
  decision: NegotiationDecision;
  response_message: string | null;
};

export type NegotiationResponseValidationResult =
  | {
      ok: true;
      value: ValidatedNegotiationResponse;
    }
  | {
      ok: false;
      error: string;
    };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function validateNegotiationResponse(
  input: unknown,
): NegotiationResponseValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      error: "Negotiation response data must be an object.",
    };
  }

  if (
    typeof input.negotiation_id !== "string" ||
    !isValidUuid(input.negotiation_id)
  ) {
    return {
      ok: false,
      error: "A valid negotiation ID is required.",
    };
  }

  if (
    input.decision !== "accepted" &&
    input.decision !== "rejected"
  ) {
    return {
      ok: false,
      error: "Decision must be accepted or rejected.",
    };
  }

  let responseMessage: string | null = null;
  if (input.response_message !== undefined && input.response_message !== null) {
    if (typeof input.response_message !== "string") {
      return {
        ok: false,
        error: "Rejection reason must be text.",
      };
    }

    responseMessage = input.response_message.trim();
  }

  if (
    input.decision === "rejected" &&
    (!responseMessage ||
      responseMessage.length < 3 ||
      responseMessage.length > 500)
  ) {
    return {
      ok: false,
      error: "A rejection reason between 3 and 500 characters is required.",
    };
  }

  if (input.decision === "accepted" && responseMessage !== null) {
    return {
      ok: false,
      error: "An acceptance response cannot include a rejection reason.",
    };
  }

  return {
    ok: true,
    value: {
      negotiation_id: input.negotiation_id,
      decision: input.decision,
      response_message: responseMessage,
    },
  };
}
