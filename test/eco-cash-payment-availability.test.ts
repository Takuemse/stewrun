import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { ecoCashPaymentsUnavailableResponse } from "../lib/eco-cash-payment-availability";

describe("EcoCash payment availability", () => {
  it("returns a non-cacheable unavailable response without initiating payment", async () => {
    const response = ecoCashPaymentsUnavailableResponse();
    const body = (await response.json()) as { error: string };

    assert.equal(response.status, 410);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.match(body.error, /EcoCash payments are not available yet/);
  });
});
