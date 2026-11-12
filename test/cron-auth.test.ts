
import * as mocha from "mocha";
import assert from "node:assert";

import {
  isAuthorizedCronRequest,
} from "../lib/server/cron-auth.server";

const { describe, it } = mocha;

describe("Cron authentication", () => {
  const secret = "test-cron-secret";

  function createRequest(authorization?: string): Request {
    const headers = new Headers();

    if (authorization) {
      headers.set("authorization", authorization);
    }

    return new Request(
      "http://localhost/api/cron/ecocash-reconciliation",
      { headers },
    );
  }

  it("accepts the correct bearer secret", () => {
    assert.strictEqual(
      isAuthorizedCronRequest(
        createRequest(`Bearer ${secret}`),
        secret,
      ),
      true,
    );
  });

  it("rejects an incorrect bearer secret", () => {
    assert.strictEqual(
      isAuthorizedCronRequest(
        createRequest("Bearer incorrect-secret"),
        secret,
      ),
      false,
    );
  });

  it("rejects a missing authorization header", () => {
    assert.strictEqual(
      isAuthorizedCronRequest(createRequest(), secret),
      false,
    );
  });

  it("rejects a missing configured secret", () => {
    assert.strictEqual(
      isAuthorizedCronRequest(
        createRequest(`Bearer ${secret}`),
        undefined,
      ),
      false,
    );
  });

  it("rejects a malformed authorization header", () => {
    assert.strictEqual(
      isAuthorizedCronRequest(
        createRequest(secret),
        secret,
      ),
      false,
    );
  });
});
