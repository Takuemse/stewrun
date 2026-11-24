export const PARSED_MEAL_DRAFT_KEY = "stewrun:parsed-meal-draft:v1";

export interface ParsedMealDraft {
  description: string;
  items: Array<{ name: string; quantity: number }>;
  hub?: "Eastgate" | "Joina City" | "Avondale";
  pickupTime?: string;
  budget?: number | null;
}

function isParsedMealDraft(value: unknown): value is ParsedMealDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.description === "string" && draft.description.trim().length > 0 &&
    Array.isArray(draft.items) && draft.items.length > 0 && draft.items.length <= 20 &&
    (draft.hub === undefined || draft.hub === "Eastgate" || draft.hub === "Joina City" || draft.hub === "Avondale") &&
    (draft.pickupTime === undefined || (typeof draft.pickupTime === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.pickupTime))) &&
    (draft.budget === undefined || draft.budget === null || (typeof draft.budget === "number" && Number.isFinite(draft.budget) && draft.budget > 0 && Math.abs(draft.budget * 100 - Math.round(draft.budget * 100)) < 0.000001)) &&
    draft.items.every((item) => {
      if (typeof item !== "object" || item === null) return false;
      const meal = item as Record<string, unknown>;
      return typeof meal.name === "string" && meal.name.trim().length >= 2 && meal.name.length <= 150 &&
        typeof meal.quantity === "number" && Number.isInteger(meal.quantity) && meal.quantity >= 1 && meal.quantity <= 20;
    });
}

export function saveParsedMealDraft(draft: ParsedMealDraft): void {
  try { window.sessionStorage.setItem(PARSED_MEAL_DRAFT_KEY, JSON.stringify(draft)); } catch { /* Optional browser handoff. */ }
}

export function readParsedMealDraft(): ParsedMealDraft | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(PARSED_MEAL_DRAFT_KEY) ?? "null");
    return isParsedMealDraft(value) ? value : null;
  } catch { return null; }
}

export function clearParsedMealDraft(): void {
  try { window.sessionStorage.removeItem(PARSED_MEAL_DRAFT_KEY); } catch { /* Optional browser handoff. */ }
}
