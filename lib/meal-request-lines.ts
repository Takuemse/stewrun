export const MAX_MEAL_REQUEST_LINES = 20;
export const MAX_MEAL_REQUEST_PLATES = 20;

export interface MealRequestLine {
  name: string;
  quantity: number;
}

export function getMealRequestPlateCount(lines: readonly MealRequestLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function validateMealRequestLines(
  lines: readonly MealRequestLine[],
): string | null {
  if (lines.length === 0) return "Add at least one meal.";
  if (lines.length > MAX_MEAL_REQUEST_LINES) return "A request can include up to 20 meal choices.";

  for (const [index, line] of lines.entries()) {
    if (line.name.trim().length < 2 || line.name.trim().length > 150) {
      return `Meal ${index + 1} needs a name between 2 and 150 characters.`;
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_MEAL_REQUEST_PLATES) {
      return `Meal ${index + 1} must have between 1 and 20 plates.`;
    }
  }

  if (getMealRequestPlateCount(lines) > MAX_MEAL_REQUEST_PLATES) {
    return `A lunch request can include up to ${MAX_MEAL_REQUEST_PLATES} plates in total.`;
  }

  return null;
}

export function mergeDuplicateMealRequestLines(
  lines: readonly MealRequestLine[],
): MealRequestLine[] {
  const merged = new Map<string, MealRequestLine>();
  for (const line of lines) {
    const name = line.name.trim();
    const key = name.toLocaleLowerCase();
    const current = merged.get(key);
    if (current) current.quantity += line.quantity;
    else merged.set(key, { name, quantity: line.quantity });
  }
  return [...merged.values()];
}
