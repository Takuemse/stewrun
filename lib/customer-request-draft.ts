export const CUSTOMER_REQUEST_DRAFT_KEY = "stewrun:customer-request-draft:v1";

export interface CustomerRequestDraft {
  description: string;
  quantity: number;
  budgetPerPlate: string;
  pickupHub: "Eastgate" | "Joina City" | "Avondale";
  pickupDate: string;
  pickupTime: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isCustomerRequestDraft(value: unknown): value is CustomerRequestDraft {
  if (!isRecord(value)) return false;

  return (
    typeof value.description === "string" &&
    value.description.trim().length > 0 &&
    value.description.length <= 500 &&
    typeof value.quantity === "number" &&
    Number.isInteger(value.quantity) &&
    value.quantity >= 1 &&
    value.quantity <= 20 &&
    typeof value.budgetPerPlate === "string" &&
    /^\d+(?:\.\d{1,2})?$/.test(value.budgetPerPlate) &&
    Number(value.budgetPerPlate) > 0 &&
    Number(value.budgetPerPlate) <= 99_999_999.99 &&
    (value.pickupHub === "Eastgate" ||
      value.pickupHub === "Joina City" ||
      value.pickupHub === "Avondale") &&
    typeof value.pickupDate === "string" &&
    isValidDate(value.pickupDate) &&
    typeof value.pickupTime === "string" &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.pickupTime)
  );
}

export function saveCustomerRequestDraft(draft: CustomerRequestDraft): void {
  try {
    window.localStorage.setItem(
      CUSTOMER_REQUEST_DRAFT_KEY,
      JSON.stringify(draft),
    );
  } catch {
    // The account flow can continue even if browser storage is unavailable.
  }
}

export function readCustomerRequestDraft(): CustomerRequestDraft | null {
  try {
    const stored = window.localStorage.getItem(CUSTOMER_REQUEST_DRAFT_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    return isCustomerRequestDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCustomerRequestDraft(): void {
  try {
    window.localStorage.removeItem(CUSTOMER_REQUEST_DRAFT_KEY);
  } catch {
    // Clearing an optional draft must not block the completed request flow.
  }
}
