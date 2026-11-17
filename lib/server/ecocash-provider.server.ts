
import "server-only";

export interface EcoCashChargeInput {
  clientCorrelator: string;
  referenceCode: string;
  endUserId: string;
  amount: string | number;
  currency: string;
}

export interface EcoCashProviderConfig {
  baseUrl: string;
  username: string;
  password: string;
  merchantCode: string;
  merchantPin: string;
  merchantNumber: string;
  countryCode: string;
  terminalId: string;
  location: string;
  superMerchantName: string;
  merchantName: string;
}

export type EcoCashChargeResult =
  | {
      outcome: "acknowledged";
      providerStatus: string;
      responseCode: string;
      providerReference: string | null;
    }
  | {
      outcome: "uncertain";
      reason: string;
    };

export type EcoCashLookupResult =
  | {
      outcome: "verified_success";
      providerStatus: "Charged";
      responseCode: "00";
      providerReference: string | null;
    }
  | {
      outcome: "uncertain";
      reason: string;
    };

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing EcoCash configuration: ${name}`);
  }

  return value;
}

export function getEcoCashConfig(): EcoCashProviderConfig {
  const baseUrl = getRequiredEnv("ECOCASH_BASE_URL");

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error("EcoCash base URL is invalid.");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error("EcoCash base URL must be a valid HTTPS URL.");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    username: getRequiredEnv("ECOCASH_BASIC_AUTH_USERNAME"),
    password: getRequiredEnv("ECOCASH_BASIC_AUTH_PASSWORD"),
    merchantCode: getRequiredEnv("ECOCASH_MERCHANT_CODE"),
    merchantPin: getRequiredEnv("ECOCASH_MERCHANT_PIN"),
    merchantNumber: getRequiredEnv("ECOCASH_MERCHANT_NUMBER"),
    countryCode: getRequiredEnv("ECOCASH_COUNTRY_CODE"),
    terminalId: getRequiredEnv("ECOCASH_TERMINAL_ID"),
    location: getRequiredEnv("ECOCASH_LOCATION"),
    superMerchantName: getRequiredEnv("ECOCASH_SUPER_MERCHANT_NAME"),
    merchantName: getRequiredEnv("ECOCASH_MERCHANT_NAME"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getAmount(value: string | number): number {
  const amountText = String(value);

  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amountText)) {
    throw new Error("Invalid EcoCash payment amount.");
  }

  const amount = Number(amountText);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid EcoCash payment amount.");
  }

  return amount;
}

function getLocalEcoCashNumber(endUserId: string): string {
  const match = endUserId.match(/^\+263(7[1378]\d{7})$/);

  if (!match) {
    throw new Error("Invalid EcoCash customer number.");
  }

  return match[1];
}

/**
 * Extracts a short, sanitized provider error description.
 *
 * Provider response bodies are untrusted. Never include credentials,
 * merchant PINs, customer phone numbers, or full transaction payloads.
 */
async function getSafeHttpErrorDetails(
  response: Response,
  config: EcoCashProviderConfig,
  customerNumber?: string,
): Promise<string> {
  const status = `HTTP ${response.status} (${response.statusText || "unknown status"})`;

  try {
    const rawBody = await response.text();

    if (!rawBody) {
      return status;
    }

    const secrets = [
      config.username,
      config.password,
      config.merchantPin,
      config.merchantCode,
      config.merchantNumber,
      config.terminalId,
      customerNumber ?? "",
    ].filter((secret) => secret.length > 0);

    let safeBody = rawBody.slice(0, 1000);

    for (const secret of secrets) {
      safeBody = safeBody.replaceAll(secret, "[REDACTED]");
    }

    // Redact common sensitive JSON fields even if they contain
    // values that are not identical to our configured credentials.
    safeBody = safeBody.replace(
      /("(?:password|pin|merchantPin|authorization|token|access_token|endUserId|phoneNumber)"\s*:\s*)"[^"]*"/gi,
      '$1"[REDACTED]"',
    );

    safeBody = safeBody.replace(
      /(authorization\s*:\s*basic\s+)[A-Za-z0-9+/=]+/gi,
      "$1[REDACTED]",
    );

    // Keep the diagnostic compact and on one line.
    safeBody = safeBody.replace(/\s+/g, " ").trim();

    return safeBody
      ? `${status}; provider response: ${safeBody}`
      : status;
  } catch {
    return status;
  }
}

export async function initiateEcoCashCharge(
  input: EcoCashChargeInput,
  fetchImpl: typeof fetch = fetch,
): Promise<EcoCashChargeResult> {
  const config = getEcoCashConfig();

  if (input.currency !== "USD") {
    throw new Error("Unsupported EcoCash payment currency.");
  }

  const amount = getAmount(input.amount);
  const localNumber = getLocalEcoCashNumber(input.endUserId);

  const credentials = Buffer.from(
    `${config.username}:${config.password}`,
  ).toString("base64");

  const requestBody = {
    clientCorrelator: input.clientCorrelator,
    referenceCode: input.referenceCode,
    tranType: "MER",
    endUserId: localNumber,
    paymentAmount: {
      charginginformation: {
        amount,
        currency: input.currency,
        description: "StewRun Order Payment",
      },
      chargeMetaData: {
        channel: "WEB",
        purchaseCategoryCode: "Online Payment",
        onBeHalfOf: "ECOCASH",
      },
    },
    merchantCode: config.merchantCode,
    merchantPin: config.merchantPin,
    merchantNumber: config.merchantNumber,
    countryCode: config.countryCode,
    terminalID: config.terminalId,
    location: config.location,
    superMerchantName: config.superMerchantName,
    merchantName: config.merchantName,
  };

  let response: Response;

  try {
    response = await fetchImpl(
      `${config.baseUrl}/transactions/amount/`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      },
    );
  } catch {
    return {
      outcome: "uncertain",
      reason: "The EcoCash request could not be confirmed.",
    };
  }

  if (!response.ok) {
    return {
      outcome: "uncertain",
      reason: await getSafeHttpErrorDetails(
        response,
        config,
        localNumber,
      ),
    };
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return {
      outcome: "uncertain",
      reason: "EcoCash returned an unreadable response.",
    };
  }

  if (!isRecord(payload)) {
    return {
      outcome: "uncertain",
      reason: "EcoCash returned an invalid response.",
    };
  }

  const {
    clientCorrelator,
    referenceCode,
    endUserId,
    responseCode,
    transactionOperationStatus,
    ecocashReference,
  } = payload;

  if (
    clientCorrelator !== input.clientCorrelator ||
    referenceCode !== input.referenceCode ||
    endUserId !== localNumber ||
    responseCode !== "00" ||
    transactionOperationStatus !== "Charged"
  ) {
    return {
      outcome: "uncertain",
      reason: "EcoCash returned an unverified payment response.",
    };
  }

  return {
    outcome: "acknowledged",
    providerStatus: transactionOperationStatus,
    responseCode,
    providerReference:
      typeof ecocashReference === "string"
        ? ecocashReference
        : null,
  };
}

export async function lookupEcoCashCharge(
  input: Pick<
    EcoCashChargeInput,
    "clientCorrelator" | "referenceCode" | "endUserId"
  >,
  fetchImpl: typeof fetch = fetch,
): Promise<EcoCashLookupResult> {
  const config = getEcoCashConfig();
  const localNumber = getLocalEcoCashNumber(input.endUserId);

  if (!input.clientCorrelator.trim() || !input.referenceCode.trim()) {
    throw new Error("Invalid EcoCash transaction lookup identifiers.");
  }

  const credentials = Buffer.from(
    `${config.username}:${config.password}`,
  ).toString("base64");

  const url =
    `${config.baseUrl}/${localNumber}/transactions/amount/` +
    encodeURIComponent(input.clientCorrelator);

  let response: Response;

  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    return {
      outcome: "uncertain",
      reason: "The EcoCash transaction lookup could not be confirmed.",
    };
  }

  if (!response.ok) {
    return {
      outcome: "uncertain",
      reason: await getSafeHttpErrorDetails(
        response,
        config,
        localNumber,
      ),
    };
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return {
      outcome: "uncertain",
      reason: "EcoCash returned an unreadable lookup response.",
    };
  }

  if (!isRecord(payload)) {
    return {
      outcome: "uncertain",
      reason: "EcoCash returned an invalid lookup response.",
    };
  }

  const {
    clientCorrelator,
    referenceCode,
    endUserId,
    responseCode,
    transactionOperationStatus,
    ecocashReference,
  } = payload;

  if (
    clientCorrelator !== input.clientCorrelator ||
    referenceCode !== input.referenceCode ||
    endUserId !== localNumber
  ) {
    return {
      outcome: "uncertain",
      reason: "EcoCash returned mismatched transaction identifiers.",
    };
  }

  if (
    responseCode !== "00" ||
    transactionOperationStatus !== "Charged"
  ) {
    return {
      outcome: "uncertain",
      reason: "EcoCash has not confirmed a successful payment.",
    };
  }

  return {
    outcome: "verified_success",
    providerStatus: "Charged",
    responseCode: "00",
    providerReference:
      typeof ecocashReference === "string"
        ? ecocashReference
        : null,
  };
}
