import { validateCookOffer, type ValidatedCookOffer } from "@/lib/validate-cook-offer";

export type StandardCookOfferValidation =
  | { ok: true; value: ValidatedCookOffer }
  | { ok: false; error: string };

/** Standard offers must quote every requested meal at its requested quantity. */
export function validateStandardCookOffer(input: unknown): StandardCookOfferValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Offer data must be an object." };
  }

  const record = input as Record<string, unknown>;
  if (!Array.isArray(record.items) || record.items.length < 1 || record.items.length > 20) {
    return { ok: false, error: "Add a price for every meal in the request." };
  }

  const items: ValidatedCookOffer["items"] = [];
  let totalCents = 0;

  for (const row of record.items) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      return { ok: false, error: "Each meal offer must be valid." };
    }
    const item = row as Record<string, unknown>;
    const result = validateCookOffer({
      request_id: record.request_id,
      message: record.message,
      is_alternative: false,
      items: [{ ...item, menu_item_id: null }],
    });
    if (!result.ok) return result;
    const validated = result.value.items[0];
    if (!validated.description?.trim()) {
      return { ok: false, error: "Describe what is included in each complete plate." };
    }
    totalCents += Math.round(validated.unit_price * 100) * validated.quantity;
    if (totalCents > 9_999_999_999) {
      return { ok: false, error: "The offer total exceeds the permitted amount." };
    }
    items.push(validated);
  }

  const message = typeof record.message === "string" ? record.message.trim() || null : null;
  if (message && message.length > 1000) return { ok: false, error: "Offer message cannot exceed 1000 characters." };

  return {
    ok: true,
    value: {
      request_id: String(record.request_id),
      message,
      is_alternative: false,
      items,
    },
  };
}
