export type ValidatedOrderReservation = {
  offer_id: string;
};

export type OrderReservationValidationResult =
  | {
      ok: true;
      value: ValidatedOrderReservation;
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

export function validateOrderReservation(
  input: unknown,
): OrderReservationValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      error: "Reservation data must be an object.",
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

  return {
    ok: true,
    value: {
      offer_id: input.offer_id,
    },
  };
}
