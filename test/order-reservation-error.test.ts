import * as mocha from "mocha";
import assert from "node:assert";

import {
  getReservationErrorResponse,
} from "../lib/order-reservation-error";

const { describe, it } = mocha;

describe("getReservationErrorResponse", () => {
  it("maps authentication failures to 401", () => {
    const result = getReservationErrorResponse({
      code: "P0001",
      message: "Authentication required.",
    });

    assert.strictEqual(result.status, 401);
  });

  it("maps customer role failures to 403", () => {
    const result = getReservationErrorResponse({
      code: "P0001",
      message: "Customer account required.",
    });

    assert.strictEqual(result.status, 403);
  });

  it("maps missing offers to 404", () => {
    const result = getReservationErrorResponse({
      code: "P0001",
      message: "Cook offer not found.",
    });

    assert.strictEqual(result.status, 404);
  });

  it("maps known reservation conflicts to 409", () => {
    const result = getReservationErrorResponse({
      code: "P0001",
      message: "A counteroffer is awaiting the cook's response.",
    });

    assert.strictEqual(result.status, 409);
  });

  it("maps active reservation conflicts to 409", () => {
    const result = getReservationErrorResponse({
      code: "P0001",
      message: "This meal request already has an active reservation.",
    });

    assert.strictEqual(result.status, 409);
  });

  it("maps unique constraint violations to 409", () => {
    const result = getReservationErrorResponse({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });

    assert.strictEqual(result.status, 409);
  });

  it("maps unknown P0001 exceptions to 500", () => {
    const result = getReservationErrorResponse({
      code: "P0001",
      message: "Unexpected database integrity failure.",
    });

    assert.strictEqual(result.status, 500);
  });

  it("maps other database errors to 500", () => {
    const result = getReservationErrorResponse({
      code: "XX000",
      message: "Internal database error.",
    });

    assert.strictEqual(result.status, 500);
  });
});