import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";
import { readRequestBody } from "@/lib/request-body";

const MAX_PROFILE_BODY_BYTES = 2_048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function authenticateCustomer() {
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    return {
      response: NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      ),
    };
  }

  if (auth.role !== "customer") {
    return {
      response: NextResponse.json(
        { error: "Customer access required." },
        { status: 403 },
      ),
    };
  }

  return { auth, supabase: await createServerSupabaseClient() };
}

export async function GET() {
  const access = await authenticateCustomer();
  if ("response" in access) return access.response;

  const { data, error } = await access.supabase
    .from("users")
    .select("full_name")
    .eq("id", access.auth.user.id)
    .maybeSingle();

  if (error) {
    console.error("Customer profile read failed:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to load your profile." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Customer profile not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const access = await authenticateCustomer();
  if ("response" in access) return access.response;

  const body = await readRequestBody(request, MAX_PROFILE_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      {
        error:
          body.reason === "too_large"
            ? "Request body is too large."
            : "Could not read request body.",
      },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(body.text) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const fullName =
    isRecord(value) && typeof value.full_name === "string"
      ? value.full_name.trim()
      : "";

  if (fullName.length < 2 || fullName.length > 100) {
    return NextResponse.json(
      { error: "Your name must be between 2 and 100 characters." },
      { status: 400 },
    );
  }

  const { data, error } = await access.supabase
    .from("users")
    .update({ full_name: fullName })
    .eq("id", access.auth.user.id)
    .select("full_name")
    .maybeSingle();

  if (error) {
    console.error("Customer profile update failed:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to save your profile." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Customer profile not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ profile: data });
}
