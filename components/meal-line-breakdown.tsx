
"use client";

import type { CustomerOrderItem } from "@/lib/orders-client";
import {
  checkLineTotalConsistency,
  formatUsd,
  getMealLineCountLabel,
  getMealSubtotal,
  isValidPositiveAmount,
  isValidQuantity,
} from "@/lib/meal-line-pricing";

type CookOfferItem = {
  id: string;
  offer_id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type MealLineItem = CustomerOrderItem | CookOfferItem;

interface MealLineBreakdownProps {
  items: MealLineItem[];
  className?: string;
  showDescription?: boolean;
}

function getItemKey(item: MealLineItem, index: number): string {
  if ("id" in item && item.id) return item.id;
  if ("menu_item_id" in item && item.menu_item_id) {
    return item.menu_item_id;
  }

  return `item-${index}`;
}

export function MealLineBreakdown({
  items,
  className = "",
  showDescription = true,
}: MealLineBreakdownProps) {
  if (!items || items.length === 0) {
    return null;
  }

  const subtotal = getMealSubtotal(items);

  return (
    <div className={`space-y-2 ${className}`}>
      <ul className="divide-y divide-ink-900/10" role="list">
        {items.map((item, index) => {
          const validQuantity = isValidQuantity(item.quantity);
          const validUnitPrice = isValidPositiveAmount(item.unit_price);
          const validLineTotal = isValidPositiveAmount(item.line_total);
          const validPrices = validUnitPrice && validLineTotal;
          const consistent =
            validPrices && checkLineTotalConsistency(item);

          return (
            <li
              key={getItemKey(item, index)}
              className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-900">
                  {validQuantity ? item.quantity : "Quantity unavailable"}{" "}
                  {validQuantity ? "x" : ""} {item.name}
                </p>

                {showDescription && item.description && (
                  <p className="mt-1 truncate text-xs leading-5 text-ink-900/60">
                    {item.description}
                  </p>
                )}

                <p className="mt-1 text-xs text-ink-900/60">
                  Unit price {formatUsd(item.unit_price)}

                  {!validUnitPrice && (
                    <span className="ml-1 text-clay-500">
                      (invalid price)
                    </span>
                  )}

                  {validUnitPrice &&
                    validLineTotal &&
                    !consistent && (
                      <span className="ml-1 text-saffron-500">
                        (total mismatch)
                      </span>
                    )}

                  {validUnitPrice && !validLineTotal && (
                    <span className="ml-1 text-clay-500">
                      (invalid line total)
                    </span>
                  )}
                </p>
              </div>

              <p className="whitespace-nowrap font-semibold text-ink-900">
                {formatUsd(item.line_total)}
              </p>
            </li>
          );
        })}
      </ul>

      {items.length > 1 && (
        <div className="flex items-center justify-between border-t border-ink-900/10 pt-2">
          <span className="text-sm font-medium text-ink-900/70">
            Original offer subtotal
          </span>

          <span className="font-semibold text-ink-900">
            {subtotal === null ? "Subtotal unavailable" : formatUsd(subtotal)}
          </span>
        </div>
      )}

      <p className="mt-1 text-center text-xs text-ink-900/50">
        {getMealLineCountLabel(items.length)}
      </p>
    </div>
  );
}
