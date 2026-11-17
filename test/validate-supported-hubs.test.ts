import * as mocha from "mocha";
import assert from "node:assert/strict";

import { validateSupportedHubs } from "../lib/validate-supported-hubs";

const { describe, it } = mocha;

describe("validateSupportedHubs", () => {
  it("accepts one or more unique supported hubs", () => {
    assert.deepEqual(validateSupportedHubs(["Joina City", "Avondale"]), {
      ok: true,
      value: ["Joina City", "Avondale"],
    });
  });

  it("rejects an empty selection", () => {
    assert.equal(validateSupportedHubs([]).ok, false);
  });

  it("rejects unsupported and duplicate values", () => {
    assert.equal(validateSupportedHubs(["Harare"] as unknown[]).ok, false);
    assert.equal(
      validateSupportedHubs(["Eastgate", "Eastgate"]).ok,
      false,
    );
  });
});
