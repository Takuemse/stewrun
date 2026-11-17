export type ValidatedOrderRating = {
  stars: number;
  comment: string | null;
};

export function validateOrderRating(
  value: unknown,
):
  | { ok: true; value: ValidatedOrderRating }
  | { ok: false; error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Enter a valid rating." };
  }

  const input = value as Record<string, unknown>;
  const comment =
    input.comment === undefined || input.comment === null
      ? null
      : typeof input.comment === "string"
        ? input.comment.trim() || null
        : undefined;

  if (
    !Number.isInteger(input.stars) ||
    Number(input.stars) < 1 ||
    Number(input.stars) > 5
  ) {
    return { ok: false, error: "Choose a rating from 1 to 5 stars." };
  }

  if (comment === undefined || (comment !== null && comment.length > 500)) {
    return {
      ok: false,
      error: "Your comment must be 500 characters or fewer.",
    };
  }

  return {
    ok: true,
    value: { stars: Number(input.stars), comment },
  };
}
