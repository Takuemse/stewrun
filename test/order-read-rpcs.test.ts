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

function getFunctionDefinition(name: string): string {
  const start = migration.indexOf(
    `CREATE OR REPLACE FUNCTION public.${name}(`,
  );
  assert.notStrictEqual(start, -1, `${name} should be defined`);

  const end = migration.indexOf("$function$;", start);
  assert.notStrictEqual(end, -1, `${name} should terminate`);

  return migration.slice(start, end);
}

describe("order read RPC security definitions", () => {
  it("restricts customer order list results to the authenticated customer", () => {
    const definition = getFunctionDefinition("get_customer_orders");

    assert.match(definition, /auth\.uid\(\)/);
    assert.match(definition, /u\.role = 'customer'/);
    assert.match(definition, /o\.customer_id = v_user_id/);
    assert.match(definition, /ORDER BY o\.created_at DESC/);
    assert.doesNotMatch(definition, /p_customer_id|p_user_id/);
  });

  it("restricts customer order detail to the authenticated owner", () => {
    const definition = getFunctionDefinition("get_customer_order");

    assert.match(definition, /auth\.uid\(\)/);
    assert.match(definition, /u\.role = 'customer'/);
    assert.match(definition, /o\.id = p_order_id/);
    assert.match(definition, /o\.customer_id = v_user_id/);
  });

  it("restricts cook results to approved cooks and their paid orders", () => {
    const definition = getFunctionDefinition("get_cook_orders");

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

  it("uses fixed search paths and limits RPC execution to authenticated users", () => {
    for (const name of [
      "get_customer_orders",
      "get_customer_order",
      "get_cook_orders",
    ]) {
      const definition = getFunctionDefinition(name);

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
