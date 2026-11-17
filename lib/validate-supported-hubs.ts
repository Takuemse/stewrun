export const SUPPORTED_PICKUP_HUBS = [
  "Eastgate",
  "Joina City",
  "Avondale",
] as const;

export type SupportedPickupHub = (typeof SUPPORTED_PICKUP_HUBS)[number];

export function validateSupportedHubs(
  value: unknown,
):
  | { ok: true; value: SupportedPickupHub[] }
  | { ok: false; error: string } {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > SUPPORTED_PICKUP_HUBS.length ||
    value.some(
      (hub) =>
        typeof hub !== "string" ||
        !SUPPORTED_PICKUP_HUBS.includes(hub as SupportedPickupHub),
    ) ||
    new Set(value).size !== value.length
  ) {
    return {
      ok: false,
      error: "Choose at least one valid pickup hub.",
    };
  }

  return { ok: true, value: value as SupportedPickupHub[] };
}
