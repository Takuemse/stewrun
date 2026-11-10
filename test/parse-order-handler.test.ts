import * as mocha from "mocha";
import assert from "node:assert";

import {
  handleParseOrderRequest,
  type AIResponseLike,
  type ParseOrderDependencies,
} from "../lib/parse-order-handler";

import type { AuthResult } from "../lib/supabase/auth.server";
import { MAX_PARSE_INPUT_LENGTH } from "../lib/parse-order";

const { describe, it } = mocha;

const customerAuth = {
  ok: true,
  role: "customer",
  user: {},
} as unknown as AuthResult;

const cookAuth = {
  ok: true,
  role: "cook",
  user: {},
} as unknown as AuthResult;

const validOrder = {
  items: [{ name: "Sadza and meat", quantity: 1 }],
  hub: "Eastgate",
  pickup_time: "12:00",
  confidence: "high",
  notes: "",
};

function createAIResponse(
  overrides: Partial<AIResponseLike> = {},
): AIResponseLike {
  return {
    status: "completed",
    output_text: JSON.stringify(validOrder),
    incomplete_details: null,
    output: [],
    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<ParseOrderDependencies> = {},
): ParseOrderDependencies {
  return {
    authenticate: async () => customerAuth,
    apiKey: "test-api-key",
    createAIResponse: async () => createAIResponse(),
    ...overrides,
  };
}

function createRequest(
  body: unknown,
): Request {
  return new Request("http://localhost/api/parse-order", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: typeof body === "string"
      ? body
      : JSON.stringify(body),
  });
}

async function getJson(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("handleParseOrderRequest", () => {
  describe("authentication", () => {
    it("rejects unauthenticated users", async () => {
      const dependencies = createDependencies({
        authenticate: async () => ({
          ok: false,
          status: 401,
          error: "Unauthorized",
        }),
      });

      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        dependencies,
      );

      assert.strictEqual(response.status, 401);
      assert.strictEqual(
        (await getJson(response)).error,
        "Unauthorized",
      );
    });

    it("rejects authenticated cooks", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies({
          authenticate: async () => cookAuth,
        }),
      );

      assert.strictEqual(response.status, 403);
    });

    it("allows authenticated customers to continue", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies(),
      );

      assert.strictEqual(response.status, 200);
    });
  });

  describe("request validation", () => {
    it("rejects malformed JSON", async () => {
      const response = await handleParseOrderRequest(
        createRequest("{invalid json"),
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects a non-object JSON body", async () => {
      const response = await handleParseOrderRequest(
        createRequest(["Sadza"]),
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects a missing input field", async () => {
      const response = await handleParseOrderRequest(
        createRequest({}),
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects an empty input string", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "   " }),
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects a non-string input", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: 123 }),
        createDependencies(),
      );

      assert.strictEqual(response.status, 400);
    });

    it("rejects an oversized request body", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "A".repeat(17_000) }),
        createDependencies(),
      );

      assert.strictEqual(response.status, 413);
    });

    it("rejects input exceeding the maximum character length", async () => {
      const response = await handleParseOrderRequest(
        createRequest({
          input: "A".repeat(MAX_PARSE_INPUT_LENGTH + 1),
        }),
        createDependencies(),
      );

      assert.strictEqual(response.status, 413);
    });

    it("does not call OpenAI for invalid input", async () => {
      let called = false;

      const response = await handleParseOrderRequest(
        createRequest({ input: "" }),
        createDependencies({
          createAIResponse: async () => {
            called = true;
            return createAIResponse();
          },
        }),
      );

      assert.strictEqual(response.status, 400);
      assert.strictEqual(called, false);
    });
  });

  describe("API configuration", () => {
    it("returns an error when the API key is missing", async () => {
      let called = false;

      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies({
          apiKey: undefined,
          createAIResponse: async () => {
            called = true;
            return createAIResponse();
          },
        }),
      );

      assert.strictEqual(response.status, 500);
      assert.strictEqual(called, false);
    });
  });

  describe("OpenAI request failures", () => {
    const cases = [
      { status: 401, expected: 502 },
      { status: 429, expected: 429 },
      { status: 500, expected: 503 },
      { status: 502, expected: 503 },
      { status: 503, expected: 503 },
      { status: 408, expected: 504 },
      { status: 504, expected: 504 },
      { status: 400, expected: 502 },
    ];

    for (const testCase of cases) {
      it(
        `maps OpenAI status ${testCase.status} to HTTP ${testCase.expected}`,
        async () => {
          const response = await handleParseOrderRequest(
            createRequest({ input: "Sadza and meat" }),
            createDependencies({
              createAIResponse: async () => {
                throw Object.assign(
                  new Error("Mock OpenAI error"),
                  { status: testCase.status },
                );
              },
            }),
          );

          assert.strictEqual(response.status, testCase.expected);
        },
      );
    }

    it("handles errors without an HTTP status", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies({
          createAIResponse: async () => {
            throw new Error("Unexpected failure");
          },
        }),
      );

      assert.strictEqual(response.status, 502);
    });
  });

  describe("AI response validation", () => {
    it("rejects an incomplete AI response", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies({
          createAIResponse: async () =>
            createAIResponse({
              status: "incomplete",
              incomplete_details: { reason: "max_output_tokens" },
            }),
        }),
      );

      assert.strictEqual(response.status, 502);
    });

    it("rejects a response blocked by the content filter", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies({
          createAIResponse: async () =>
            createAIResponse({
              status: "incomplete",
              incomplete_details: { reason: "content_filter" },
            }),
        }),
      );

      assert.strictEqual(response.status, 422);
    });

    it("rejects AI refusals", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies({
          createAIResponse: async () =>
            createAIResponse({
              output: [
                {
                  type: "message",
                  content: [{ type: "refusal" }],
                },
              ],
            }),
        }),
      );

      assert.strictEqual(response.status, 422);
    });

    it("rejects completed responses without output text", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies({
          createAIResponse: async () =>
            createAIResponse({ output_text: "" }),
        }),
      );

      assert.strictEqual(response.status, 502);
    });

    it("rejects malformed AI JSON output", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies({
          createAIResponse: async () =>
            createAIResponse({ output_text: "{invalid json" }),
        }),
      );

      assert.strictEqual(response.status, 502);
    });

    it("rejects an AI interpretation with no meal items", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "I want lunch" }),
        createDependencies({
          createAIResponse: async () =>
            createAIResponse({
              output_text: JSON.stringify({
                ...validOrder,
                items: [],
              }),
            }),
        }),
      );

      assert.strictEqual(response.status, 422);
    });

    it("rejects invalid AI-generated order data", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies({
          createAIResponse: async () =>
            createAIResponse({
              output_text: JSON.stringify({
                ...validOrder,
                hub: "Invalid Hub",
              }),
            }),
        }),
      );

      assert.strictEqual(response.status, 422);
    });
  });

  describe("successful interpretation", () => {
    it("returns a validated meal interpretation", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies(),
      );

      const body = await getJson(response);

      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(body.items, [
        { name: "Sadza and meat", quantity: 1 },
      ]);
      assert.strictEqual(body.hub, "Eastgate");
      assert.strictEqual(body.pickup_time, "12:00");
      assert.strictEqual(body.confidence, "high");
    });

    it("trims customer input before sending it to OpenAI", async () => {
      let receivedInput = "";

      const response = await handleParseOrderRequest(
        createRequest({ input: "  Sadza and meat  " }),
        createDependencies({
          createAIResponse: async (input) => {
            receivedInput = input;
            return createAIResponse();
          },
        }),
      );

      assert.strictEqual(response.status, 200);
      assert.strictEqual(receivedInput, "Sadza and meat");
    });

    it("supplies the meal interpretation instructions", async () => {
      let receivedInstructions = "";

      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza ne nyama" }),
        createDependencies({
          createAIResponse: async (_input, instructions) => {
            receivedInstructions = instructions;
            return createAIResponse();
          },
        }),
      );

      assert.strictEqual(response.status, 200);
      assert.ok(receivedInstructions.includes("Shona"));
      assert.ok(receivedInstructions.includes("Never invent"));
      assert.ok(receivedInstructions.includes("Eastgate"));
    });

    it("adds a verification warning to low-confidence interpretations", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies({
          createAIResponse: async () =>
            createAIResponse({
              output_text: JSON.stringify({
                ...validOrder,
                confidence: "low",
                notes: "The meal description is unclear.",
              }),
            }),
        }),
      );

      const body = await getJson(response);

      assert.strictEqual(response.status, 200);
      assert.ok(
        String(body.notes).includes("(please verify carefully)"),
      );
    });

    it("adds a verification warning when low-confidence notes are empty", async () => {
      const response = await handleParseOrderRequest(
        createRequest({ input: "Sadza and meat" }),
        createDependencies({
          createAIResponse: async () =>
            createAIResponse({
              output_text: JSON.stringify({
                ...validOrder,
                confidence: "low",
                notes: "",
              }),
            }),
        }),
      );

      const body = await getJson(response);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(
        body.notes,
        "(please verify this interpretation carefully)",
      );
    });
  });
});
