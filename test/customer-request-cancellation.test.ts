import * as mocha from "mocha";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const { describe, it } = mocha;

describe("customer request cancellation migration", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20261116123000_customer_request_cancellation.sql",
    ),
    "utf8",
  );

  it("limits cancellation to the owning authenticated customer and open requests", () => {
    assert.match(migration, /v_user_id uuid := \(SELECT auth\.uid\(\)\)/);
    assert.match(migration, /request\.customer_id = v_user_id/);
    assert.match(migration, /IF v_status <> 'open'/);
    assert.match(migration, /SET status = 'cancelled'/);
  });

  it("protects confirmed orders and notifies cooks with submitted offers", () => {
    assert.match(migration, /order_row\.status IN \('confirmed', 'ready', 'collected'\)/);
    assert.match(migration, /offer\.status = 'submitted'/);
    assert.match(migration, /:cancelled/);
  });
});
