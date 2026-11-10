export const MAX_COUNTEROFFER_MESSAGE_LENGTH = 1000;
export const MAX_COUNTEROFFER_TOTAL = 99_999_999.99;

export type ValidatedCustomerCounteroffer = {
  offer_id: string;
  proposed_total: number;
  message: string | null;
};

export type CustomerCounterofferValidationResult =
  | {
      ok: true;
      value: ValidatedCustomerCounteroffer;
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

function isValidAmount(value: unknown): value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAX_COUNTEROFFER_TOTAL
  ) {
    return false;
  }

  const cents = value * 100;

  return Math.abs(cents - Math.round(cents)) < 0.000001;
}

export function validateCustomerCounteroffer(
  input: unknown,
): CustomerCounterofferValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      error: "Counteroffer data must be an object.",
    };
  }

  if (
    typeof input.offer_id !== "string" ||
    !isValidUuid(input.offer_id)
  ) {
    return {
      ok: false,
      error: "A valid cook offer ID is required.",
    };
  }

  if (!isValidAmount(input.proposed_total)) {
    return {
      ok: false,
      error:
        "Counteroffer amount must be positive and have no more than two decimal places.",
    };
  }

  let message: string | null = null;

  if (input.message !== undefined && input.message !== null) {
    if (typeof input.message !== "string") {
      return {
        ok: false,
        error: "Counteroffer message must be text.",
      };
    }

    message = input.message.trim();

    if (message.length > MAX_COUNTEROFFER_MESSAGE_LENGTH) {
      return {
        ok: false,
        error: "Counteroffer message cannot exceed 1000 characters.",
      };
    }

    if (message.length === 0) {
      message = null;
    }
  }

  return {
    ok: true,
    value: {
      offer_id: input.offer_id,
      proposed_total: input.proposed_total,
      message,
    },
  };
}
