export const MAX_OFFER_ITEMS = 20;
export const MAX_OFFER_ITEM_NAME_LENGTH = 150;
export const MAX_OFFER_DESCRIPTION_LENGTH = 500;
export const MAX_OFFER_MESSAGE_LENGTH = 1000;

const MAX_UNIT_PRICE = 99_999_999.99;
const MAX_OFFER_TOTAL_CENTS = 9_999_999_999;

export type ValidatedCookOfferItem = {
  menu_item_id: string | null;
  name?: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
};

export type ValidatedCookOffer = {
  request_id: string;
  message: string | null;
  items: ValidatedCookOfferItem[];
};

export type CookOfferValidationResult =
  | {
      ok: true;
      value: ValidatedCookOffer;
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

function isValidPrice(value: unknown): value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAX_UNIT_PRICE
  ) {
    return false;
  }

  const cents = value * 100;

  return Math.abs(cents - Math.round(cents)) < 0.000001;
}

export function validateCookOffer(
  input: unknown,
): CookOfferValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      error: "Offer data must be an object.",
    };
  }

  const requestId = input.request_id;

  if (
    typeof requestId !== "string" ||
    !isValidUuid(requestId)
  ) {
    return {
      ok: false,
      error: "A valid meal request ID is required.",
    };
  }

  let message: string | null = null;

  if (input.message !== undefined && input.message !== null) {
    if (typeof input.message !== "string") {
      return {
        ok: false,
        error: "Offer message must be text.",
      };
    }

    message = input.message.trim();

    if (message.length > MAX_OFFER_MESSAGE_LENGTH) {
      return {
        ok: false,
        error: "Offer message cannot exceed 1000 characters.",
      };
    }

    if (message.length === 0) {
      message = null;
    }
  }

  if (!Array.isArray(input.items)) {
    return {
      ok: false,
      error: "Offer items must be an array.",
    };
  }

  if (
    input.items.length < 1 ||
    input.items.length > MAX_OFFER_ITEMS
  ) {
    return {
      ok: false,
      error: "An offer must contain between 1 and 20 items.",
    };
  }

  const validatedItems: ValidatedCookOfferItem[] = [];
  let totalCents = 0;

  for (let index = 0; index < input.items.length; index += 1) {
    const item = input.items[index];

    if (!isRecord(item)) {
      return {
        ok: false,
        error: `Offer item ${index + 1} must be an object.`,
      };
    }

    // Existing menu items are optional references.
    // Their name and description will come from the database.
    let menuItemId: string | null = null;

    if (
      item.menu_item_id !== undefined &&
      item.menu_item_id !== null &&
      item.menu_item_id !== ""
    ) {
      if (
        typeof item.menu_item_id !== "string" ||
        !isValidUuid(item.menu_item_id)
      ) {
        return {
          ok: false,
          error: `Offer item ${index + 1} has an invalid menu item ID.`,
        };
      }

      menuItemId = item.menu_item_id;
    }

    // Custom meals must provide their own name and description.
    let name: string | undefined;
    let description: string | null | undefined;

    if (menuItemId === null) {
      if (typeof item.name !== "string") {
        return {
          ok: false,
          error: `Custom meal ${index + 1} requires a name.`,
        };
      }

      name = item.name.trim();

      if (
        name.length < 2 ||
        name.length > MAX_OFFER_ITEM_NAME_LENGTH
      ) {
        return {
          ok: false,
          error: `Custom meal ${index + 1} must have a name between 2 and 150 characters.`,
        };
      }

      if (
        item.description !== undefined &&
        item.description !== null &&
        typeof item.description !== "string"
      ) {
        return {
          ok: false,
          error: `Description for custom meal ${index + 1} must be text.`,
        };
      }

      description =
        typeof item.description === "string"
          ? item.description.trim() || null
          : null;

      if (
        description !== null &&
        description.length > MAX_OFFER_DESCRIPTION_LENGTH
      ) {
        return {
          ok: false,
          error: `Description for custom meal ${index + 1} cannot exceed 500 characters.`,
        };
      }
    }

    if (
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20
    ) {
      return {
        ok: false,
        error: `Quantity for offer item ${index + 1} must be a whole number between 1 and 20.`,
      };
    }

    if (!isValidPrice(item.unit_price)) {
      return {
        ok: false,
        error: `Price for offer item ${index + 1} must be positive and have no more than two decimal places.`,
      };
    }

    const unitPriceCents = Math.round(item.unit_price * 100);
    const lineTotalCents = unitPriceCents * item.quantity;

    totalCents += lineTotalCents;

    if (totalCents > MAX_OFFER_TOTAL_CENTS) {
      return {
        ok: false,
        error: "The offer total exceeds the permitted amount.",
      };
    }

    validatedItems.push({
      menu_item_id: menuItemId,
      ...(menuItemId === null
        ? {
            name,
            description,
          }
        : {}),
      quantity: item.quantity,
      unit_price: item.unit_price,
    });
  }

  return {
    ok: true,
    value: {
      request_id: requestId,
      message,
      items: validatedItems,
    },
  };
}