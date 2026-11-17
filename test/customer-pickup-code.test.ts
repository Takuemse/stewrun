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
    "20261116055500_customer_ready_order_pickup_code.sql",
  ),
  "utf8",
);

function getFunctionDefinition(name: string) {
  const start = migration.indexOf(
    `CREATE FUNCTION public.${name}(`,
  );
  assert.notStrictEqual(start, -1, `${name} should be defined`);

  const end = migration.indexOf("$function$;", start);
  assert.notStrictEqual(end, -1, `${name} should terminate`);

  return migration.slice(start, end);
}

describe("customer pickup code RPCs", () => {
  for (const name of ["get_customer_orders", "get_customer_order"]) {
    it(`returns pickup codes only for the owning customer when paid and ready: ${name}`, () => {
      const definition = getFunctionDefinition(name);

      assert.match(definition, /auth\.uid\(\)/);
      assert.match(definition, /u\.role = 'customer'/);
      assert.match(definition, /o\.customer_id = v_user_id/);
      assert.match(
        definition,
        /WHEN o\.payment_status = 'paid'\s+AND o\.status = 'ready'\s+THEN o\.pickup_code\s+ELSE NULL::text/,
      );
    });
  }
});
