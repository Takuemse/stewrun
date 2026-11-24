
import * as mocha from "mocha";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { describe, it } = mocha;

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261116054500_secure_order_read_rpcs.sql",
  ),
  "utf8",
);

const pricingMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261118075700_expose_customer_order_pricing.sql",
  ),
  "utf8",
);

function getFunctionDefinition(
  source: string,
  name: string,
  declaration: "CREATE" | "CREATE OR REPLACE" = "CREATE OR REPLACE",
): string {
  const start = source.indexOf(
    `${declaration} FUNCTION public.${name}(`,
  );
  assert.notStrictEqual(start, -1, `${name} should be defined`);

  const end = source.indexOf("$function$;", start);
  assert.notStrictEqual(end, -1, `${name} should terminate`);

  return source.slice(start, end);
}

function getOriginalFunctionDefinition(name: string): string {
  return getFunctionDefinition(migration, name);
}

function getPricingFunctionDefinition(name: string): string {
  return getFunctionDefinition(pricingMigration, name, "CREATE");
}

describe("order read RPC security definitions", () => {
  it("restricts customer order list results to the authenticated customer", () => {
    const definition = getOriginalFunctionDefinition("get_customer_orders");

    assert.match(definition, /auth\.uid\(\)/);
    assert.match(definition, /u\.role = 'customer'/);
    assert.match(definition, /o\.customer_id = v_user_id/);
    assert.match(definition, /ORDER BY o\.created_at DESC/);
    assert.doesNotMatch(definition, /p_customer_id|p_user_id/);
  });

  it("restricts customer order detail to the authenticated owner", () => {
    const definition = getOriginalFunctionDefinition("get_customer_order");

    assert.match(definition, /auth\.uid\(\)/);
    assert.match(definition, /u\.role = 'customer'/);
    assert.match(definition, /o\.id = p_order_id/);
    assert.match(definition, /o\.customer_id = v_user_id/);
  });

  it("restricts cook results to approved cooks and their paid orders", () => {
    const definition = getOriginalFunctionDefinition("get_cook_orders");

    assert.match(definition, /auth\.uid\(\)/);
    assert.match(definition, /u\.role = 'cook'/);
    assert.match(definition, /cp\.status = 'approved'/);
    assert.match(definition, /o\.cook_id = v_user_id/);
    assert.match(definition, /o\.payment_status = 'paid'/);
    assert.match(
      definition,
      /o\.status IN \('confirmed', 'ready', 'collected'\)/,
    );
    assert.doesNotMatch(
      definition,
      /customer_id|pickup_code|payment_reference|payment_provider/,
    );
  });

  it("uses fixed search paths and limits original RPC execution to authenticated users", () => {
    for (const name of [
      "get_customer_orders",
      "get_customer_order",
      "get_cook_orders",
    ]) {
      const definition = getOriginalFunctionDefinition(name);

      assert.match(definition, /SECURITY DEFINER/);
      assert.match(definition, /SET search_path TO ''/);
      assert.match(
        migration,
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${name}\\([\\s\\S]*?FROM PUBLIC, anon, authenticated, service_role;`,
        ),
      );
      assert.match(
        migration,
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${name}\\([\\s\\S]*?TO authenticated;`,
        ),
      );
    }
  });

  it("revokes table and per-column SELECT from authenticated roles", () => {
    assert.match(
      migration,
      /REVOKE ALL PRIVILEGES ON TABLE public\.orders\s+FROM PUBLIC, anon, authenticated;/,
    );
    assert.match(
      migration,
      /REVOKE SELECT \([\s\S]*?payment_reference[\s\S]*?\)\s*ON TABLE public\.orders\s+FROM PUBLIC, anon, authenticated;/,
    );
  });
});

describe("customer order pricing migration", () => {
  const expectedColumns = [
    "id",
    "total",
    "meal_subtotal",
    "original_offer_total",
    "negotiated_discount",
    "platform_fee",
    "status",
    "payment_status",
    "hub",
    "pickup_date",
    "pickup_time",
    "reservation_expires_at",
    "pickup_code",
    "cash_payment_status",
    "items",
    "cook_display_name",
  ];

  for (const name of ["get_customer_orders", "get_customer_order"]) {
    it(`${name} returns the expected customer-safe pricing columns`, () => {
      const definition = getPricingFunctionDefinition(name);
      const returnTable = definition.match(
        /RETURNS TABLE\s*\(([\s\S]*?)\)\s*LANGUAGE/i,
      )?.[1];

      assert.ok(returnTable, `${name} should declare RETURNS TABLE`);

      const actualColumns = returnTable.match(
        /^\s*([a-z_]+)\s+/gm,
      )?.map((column) => column.trim().split(/\s+/)[0]);

      assert.deepStrictEqual(actualColumns, expectedColumns);

      for (const field of [
        "meal_subtotal",
        "original_offer_total",
        "negotiated_discount",
        "platform_fee",
      ]) {
        assert.match(definition, new RegExp(`o\\.${field}\\b`));
      }

      assert.doesNotMatch(
        definition,
        /platform_commission|cook_share/,
      );
    });
  }

  it("preserves customer authentication and ownership checks in both recreated functions", () => {
    const listDefinition = getPricingFunctionDefinition(
      "get_customer_orders",
    );
    const detailDefinition = getPricingFunctionDefinition(
      "get_customer_order",
    );

    for (const definition of [listDefinition, detailDefinition]) {
      assert.match(definition, /auth\.uid\(\)/);
      assert.match(definition, /u\.role = 'customer'/);
      assert.match(definition, /SECURITY DEFINER/);
      assert.match(definition, /SET search_path TO ''/);
    }

    assert.match(listDefinition, /o\.customer_id = v_user_id/);
    assert.match(listDefinition, /ORDER BY o\.created_at DESC/);

    assert.match(detailDefinition, /o\.id = p_order_id/);
    assert.match(detailDefinition, /o\.customer_id = v_user_id/);
  });

  it("preserves restricted execution permissions for both recreated functions", () => {
    for (const name of ["get_customer_orders", "get_customer_order"]) {
      assert.match(
        pricingMigration,
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${name}\\([\\s\\S]*?FROM PUBLIC, anon, authenticated, service_role;`,
        ),
      );

      assert.match(
        pricingMigration,
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${name}\\([\\s\\S]*?TO authenticated;`,
        ),
      );
    }
  });
});
