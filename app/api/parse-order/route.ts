import OpenAI from "openai";

import { getAuthenticatedUser } from "@/lib/supabase/auth.server";
import {
  handleParseOrderRequest,
  type AIResponseLike,
} from "@/lib/parse-order-handler";

import { MAX_MEAL_ITEMS } from "@/lib/parse-order";

const OPENAI_MODEL = "gpt-6-luna";

const orderResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      minItems: 0,
      maxItems: MAX_MEAL_ITEMS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            description:
              "The exact food or meal requested, accurately interpreted.",
          },
          quantity: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Number of portions requested.",
          },
        },
        required: ["name", "quantity"],
      },
    },
    hub: {
      type: "string",
      enum: ["Eastgate", "Joina City", "Avondale"],
    },
    pickup_time: {
      type: "string",
      description: "Pickup time in 24-hour HH:MM format.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
    notes: {
      type: "string",
      description: "Clarifications or assumptions made.",
    },
  },
  required: ["items", "hub", "pickup_time", "confidence", "notes"],
};

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;

  return handleParseOrderRequest(request, {
    authenticate: getAuthenticatedUser,
    apiKey,

    createAIResponse: async (
      input: string,
      instructions: string,
    ): Promise<AIResponseLike> => {
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured.");
      }

      const openai = new OpenAI({
        apiKey,
        timeout: 20000,
        maxRetries: 1,
      });

      return openai.responses.create({
        model: OPENAI_MODEL,
        instructions,
        input,
        store: false,
        max_output_tokens: 500,
        text: {
          format: {
            type: "json_schema",
            name: "stewrun_order",
            strict: true,
            schema: orderResponseSchema,
          },
        },
      });
    },
  });
}
