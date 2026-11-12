
export interface EcoCashPaymentInitiation {
  amount: string;
  currency: string;
}

export class EcoCashPaymentError extends Error {
  constructor(
    message: string,
    public readonly requiresReconciliation: boolean,
  ) {
    super(message);
    this.name = "EcoCashPaymentError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

const UNCERTAIN_PAYMENT_MESSAGE =
  "We couldn't confirm whether your payment was initiated. Do not submit another payment. Check your order status or contact support.";

export function normalizeZimbabweEcoCashPhoneNumber(
  phoneNumber: string,
): string | null {
  const compactNumber = phoneNumber.trim().replace(/[\s().-]/g, "");
  const match = compactNumber.match(
    /^(?:\+263|263|0)(7[1378]\d{7})$/,
  );

  if (!match) {
    return null;
  }

  return `+263${match[1]}`;
}

function getErrorMessage(payload: unknown): string {
  if (
    isRecord(payload) &&
    typeof payload.error === "string" &&
    payload.error.trim().length > 0
  ) {
    return payload.error;
  }

  return "Unable to start the EcoCash payment. Check your order status before trying again.";
}

function parsePaymentInitiation(
  payload: unknown,
): EcoCashPaymentInitiation {
  if (!isRecord(payload) || !isRecord(payload.payment_attempt)) {
    throw new EcoCashPaymentError(
      UNCERTAIN_PAYMENT_MESSAGE,
      true,
    );
  }

  const { amount, currency } = payload.payment_attempt;
  let amountText: string;

  if (typeof amount === "string") {
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amount)) {
      throw new EcoCashPaymentError(
        UNCERTAIN_PAYMENT_MESSAGE,
        true,
      );
    }

    amountText = amount.includes(".")
      ? amount.padEnd(amount.indexOf(".") + 3, "0")
      : `${amount}.00`;
  } else if (typeof amount === "number" && Number.isFinite(amount)) {
    amountText = amount.toFixed(2);
  } else {
    throw new EcoCashPaymentError(
      UNCERTAIN_PAYMENT_MESSAGE,
      true,
    );
  }

  if (
    !/^\d{1,10}\.\d{2}$/.test(amountText) ||
    Number(amountText) <= 0 ||
    typeof currency !== "string" ||
    !/^[A-Z]{3}$/.test(currency)
  ) {
    throw new EcoCashPaymentError(
      UNCERTAIN_PAYMENT_MESSAGE,
      true,
    );
  }

  return {
    amount: amountText,
    currency,
  };
}

export async function initiateEcoCashPayment(
  orderId: string,
  phoneNumber: string,
): Promise<EcoCashPaymentInitiation> {
  let response: Response;

  try {
    response = await fetch(
      `/api/orders/${encodeURIComponent(orderId)}/payment`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
      },
    );
  } catch {
    throw new EcoCashPaymentError(
      UNCERTAIN_PAYMENT_MESSAGE,
      true,
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new EcoCashPaymentError(
      UNCERTAIN_PAYMENT_MESSAGE,
      true,
    );
  }

  if (!response.ok) {
    const requiresReconciliation =
      isRecord(payload) &&
      payload.code === "PAYMENT_STATUS_UNCERTAIN";

    throw new EcoCashPaymentError(
      requiresReconciliation
        ? UNCERTAIN_PAYMENT_MESSAGE
        : getErrorMessage(payload),
      requiresReconciliation,
    );
  }

  return parsePaymentInitiation(payload);
}
