
import * as mocha from "mocha";
import assert from "node:assert";

import { readRequestBody } from "../lib/request-body";

const { describe, it } = mocha;

function createRequest(chunks: Uint8Array[]): Request {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }

      controller.close();
    },
  });

  return {
    body,
  } as Request;
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

describe("readRequestBody", () => {
  it("reads a body smaller than the size limit", async () => {
    const request = createRequest([encode("Hello")]);

    const result = await readRequestBody(request, 10);

    assert.deepStrictEqual(result, {
      ok: true,
      text: "Hello",
    });
  });

  it("accepts a body exactly at the size limit", async () => {
    const request = createRequest([encode("Hello")]);

    const result = await readRequestBody(request, 5);

    assert.deepStrictEqual(result, {
      ok: true,
      text: "Hello",
    });
  });

  it("rejects a body larger than the size limit", async () => {
    const request = createRequest([encode("Hello!")]);

    const result = await readRequestBody(request, 5);

    assert.deepStrictEqual(result, {
      ok: false,
      reason: "too_large",
    });
  });

  it("counts UTF-8 bytes rather than characters", async () => {
    const character = "\u00E9";
    const request = createRequest([encode(character)]);

    // U+00E9 occupies two bytes in UTF-8.
    const accepted = await readRequestBody(request, 2);

    assert.deepStrictEqual(accepted, {
      ok: true,
      text: character,
    });

    const anotherRequest = createRequest([encode(character)]);

    const rejected = await readRequestBody(anotherRequest, 1);

    assert.deepStrictEqual(rejected, {
      ok: false,
      reason: "too_large",
    });
  });

  it("accepts an empty body", async () => {
    const request = createRequest([]);

    const result = await readRequestBody(request, 10);

    assert.deepStrictEqual(result, {
      ok: true,
      text: "",
    });
  });

  it("accepts a request without a body stream", async () => {
    const request = {
      body: null,
    } as Request;

    const result = await readRequestBody(request, 10);

    assert.deepStrictEqual(result, {
      ok: true,
      text: "",
    });
  });

  it("reports a stream read failure", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("Simulated stream failure."));
      },
    });

    const request = {
      body,
    } as Request;

    const result = await readRequestBody(request, 10);

    assert.deepStrictEqual(result, {
      ok: false,
      reason: "read_error",
    });
  });

  it("still reports too_large when stream cancellation fails", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encode("Too large"));
      },
      cancel() {
        return Promise.reject(
          new Error("Simulated cancellation failure."),
        );
      },
    });

    const request = {
      body,
    } as Request;

    const result = await readRequestBody(request, 3);

    assert.deepStrictEqual(result, {
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects an invalid size limit", async () => {
    const request = createRequest([encode("Hello")]);

    await assert.rejects(
      readRequestBody(request, -1),
      /Invalid request body size limit/,
    );

    await assert.rejects(
      readRequestBody(request, 1.5),
      /Invalid request body size limit/,
    );
  });
});
