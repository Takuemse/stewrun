import * as mocha from "mocha";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { describe, it } = mocha;

function readMigration(name: string) {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", name),
    "utf8",
  );
}

function getFunctionDefinition(source: string, name: string) {
  const start = source.search(
    new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\(`),
  );
  assert.notStrictEqual(start, -1, `${name} should be defined`);
  const end = source.indexOf("$function$;", start);
  assert.notStrictEqual(end, -1, `${name} should terminate`);
  return source.slice(start, end);
}

describe("MVP database migration contracts", () => {
  const onboarding = readMigration(
    "20261116104500_direct_cook_onboarding_profiles.sql",
  );
  const cashOrders = readMigration(
    "20261116110000_cash_collection_orders.sql",
  );
  const notifications = readMigration(
    "20261116111500_in_app_notifications.sql",
  );
  const negotiationReasons = readMigration(
    "20261116113000_negotiation_rejection_reasons.sql",
  );
  const cashMvp = readMigration(
    "20261116130000_cash_mvp_offer_contract.sql",
  );

  it("limits signup roles and profile updates to safe fields", () => {
    const signup = getFunctionDefinition(onboarding, "handle_new_user");
    const offerGuard = getFunctionDefinition(
      onboarding,
      "require_available_cook_for_offer",
    );

    assert.match(signup, /v_role NOT IN \('customer', 'cook'\)/);
    assert.match(signup, /INSERT INTO public\.cook_profiles/);
    assert.match(onboarding, /GRANT UPDATE \(full_name\)/);
    assert.match(onboarding, /GRANT UPDATE \(display_name, bio, is_available\)/);
    assert.match(onboarding, /TO anon/);
    assert.match(offerGuard, /cp\.is_available/);
    assert.match(offerGuard, /SET search_path = ''/);
  });

  it("creates cash orders through existing reservation and assigned-cook rules", () => {
    const creation = getFunctionDefinition(cashOrders, "create_cash_order");
    const cookList = getFunctionDefinition(cashOrders, "get_cook_orders");
    const collection = getFunctionDefinition(
      cashOrders,
      "confirm_order_collection",
    );

    assert.match(creation, /auth\.uid\(\)/);
    assert.match(creation, /public\.create_order_reservation/);
    assert.match(creation, /payment_provider = 'cash'/);
    assert.match(creation, /cash_payment_status = 'due'/);
    assert.match(cookList, /o\.cook_id = v_user_id/);
    assert.match(cookList, /cp\.status = 'approved'/);
    assert.match(cookList, /o\.cash_payment_status = 'due'/);
    const returnedColumns = cookList.match(
      /RETURNS TABLE \(([\s\S]*?)\)/,
    )?.[1];
    assert.ok(returnedColumns);
    assert.doesNotMatch(
      returnedColumns,
      /customer_id|pickup_code|payment_reference|payment_provider/,
    );
    assert.match(collection, /IS DISTINCT FROM v_order\.pickup_code/);
    assert.match(collection, /cash_payment_status = CASE/);
  });

  it("keeps notifications owner-scoped and generated from database events", () => {
    assert.match(
      notifications,
      /USING \(recipient_id = \(SELECT auth\.uid\(\)\)\)/,
    );
    assert.match(
      notifications,
      /GRANT UPDATE \(read_at\) ON TABLE public\.notifications TO authenticated/,
    );
    assert.match(notifications, /AFTER INSERT ON public\.meal_requests/);
    assert.match(notifications, /AFTER INSERT OR UPDATE OF status ON public\.orders/);
    assert.match(
      notifications,
      /AFTER INSERT OR UPDATE OF status, response_message ON public\.negotiations/,
    );
  });

  it("requires a bounded rejection reason from the assigned approved cook", () => {
    const response = getFunctionDefinition(
      negotiationReasons,
      "respond_to_negotiation",
    );

    assert.match(response, /auth\.uid\(\)/);
    assert.match(response, /cp\.status = 'approved'/);
    assert.match(response, /n\.cook_id = v_user_id/);
    assert.match(response, /char_length\(v_message\) < 3/);
    assert.match(response, /char_length\(v_message\) > 500/);
    assert.match(response, /SET search_path = ''/);
  });

  it("enforces exact standard offer quantities and preserves alternatives", () => {
    const insertGuard = getFunctionDefinition(
      cashMvp,
      "mark_alternative_cook_offer",
    );
    const quantityGuard = getFunctionDefinition(
      cashMvp,
      "enforce_cook_offer_requested_quantity",
    );

    assert.match(cashMvp, /ADD COLUMN is_alternative boolean NOT NULL DEFAULT false/);
    assert.match(insertGuard, /NEW\.is_alternative := true/);
    assert.match(quantityGuard, /NEW\.is_alternative/);
    assert.match(quantityGuard, /offer_item\.quantity <> v_requested_plates/);
    assert.match(cashMvp, /CREATE TRIGGER enforce_cook_offer_requested_quantity_trigger/);
  });

  it("blocks new customer counteroffers while keeping the read-only order status scoped", () => {
    const orderStates = getFunctionDefinition(
      cashMvp,
      "get_customer_request_order_states",
    );

    assert.match(cashMvp, /REVOKE ALL ON FUNCTION public\.create_customer_counteroffer/);
    assert.match(cashMvp, /GRANT EXECUTE ON FUNCTION public\.get_customer_request_order_states\(\)\s+TO authenticated/);
    assert.match(orderStates, /order_row\.customer_id = v_user_id/);
    assert.match(orderStates, /user_row\.role = 'customer'/);
  });
});
