import * as mocha from "mocha";
import assert from "node:assert/strict";

import { validateOrderRating } from "../lib/validate-order-rating";

const { describe, it } = mocha;

describe("validateOrderRating", () => {
  it("accepts a star rating with a trimmed comment", () => {
    assert.deepEqual(validateOrderRating({ stars: 5, comment: "  Great food  " }), {
      ok: true,
      value: { stars: 5, comment: "Great food" },
    });
  });

  it("accepts a star rating without a comment", () => {
    assert.deepEqual(validateOrderRating({ stars: 4 }), {
      ok: true,
      value: { stars: 4, comment: null },
    });
  });

  it("rejects invalid stars and oversized comments", () => {
    assert.equal(validateOrderRating({ stars: 0 }).ok, false);
    assert.equal(validateOrderRating({ stars: 4.5 }).ok, false);
    assert.equal(
      validateOrderRating({ stars: 4, comment: "a".repeat(501) }).ok,
      false,
    );
  });
});
