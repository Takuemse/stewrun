import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";
import { readRequestBody } from "@/lib/request-body";
import { validateSupportedHubs } from "@/lib/validate-supported-hubs";

const MAX_PROFILE_BODY_BYTES = 4_096;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function authenticateCook() {
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    return {
      response: NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      ),
    };
  }

  if (auth.role !== "cook") {
    return {
      response: NextResponse.json(
        { error: "Cook access required." },
        { status: 403 },
      ),
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: profile, error } = await supabase
    .from("cook_profiles")
    .select("user_id")
    .eq("user_id", auth.user.id)
    .eq("status", "approved")
    .maybeSingle();

  if (error) {
    console.error("Cook profile lookup failed:", {
      code: error.code,
      message: error.message,
    });
    return {
      response: NextResponse.json(
        { error: "Unable to verify your cook profile." },
        { status: 500 },
      ),
    };
  }

  if (!profile) {
    return {
      response: NextResponse.json(
        { error: "An approved cook account is required." },
        { status: 403 },
      ),
    };
  }

  return { auth, supabase };
}

export async function GET() {
  const access = await authenticateCook();
  if ("response" in access) return access.response;

  const { data: profile, error } = await access.supabase
    .from("cook_profiles")
    .select("display_name, bio, is_available, supported_hubs")
    .eq("user_id", access.auth.user.id)
    .maybeSingle();

  if (error) {
    console.error("Cook profile read failed:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to load your cook profile." },
      { status: 500 },
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "Cook profile not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const access = await authenticateCook();
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

  if (!isRecord(value)) {
    return NextResponse.json(
      { error: "Enter valid profile details." },
      { status: 400 },
    );
  }

  const displayName =
    typeof value.display_name === "string" ? value.display_name.trim() : "";
  const bio =
    value.bio === null
      ? null
      : typeof value.bio === "string"
        ? value.bio.trim() || null
        : undefined;

  if (displayName.length < 2 || displayName.length > 100) {
    return NextResponse.json(
      { error: "Your display name must be 2 to 100 characters." },
      { status: 400 },
    );
  }

  if (bio === undefined || (bio !== null && bio.length > 500)) {
    return NextResponse.json(
      { error: "Your cook introduction must be 500 characters or fewer." },
      { status: 400 },
    );
  }

  if (typeof value.is_available !== "boolean") {
    return NextResponse.json(
      { error: "Choose whether you are accepting new requests." },
      { status: 400 },
    );
  }

  const supportedHubs =
    value.supported_hubs === undefined
      ? undefined
      : validateSupportedHubs(value.supported_hubs);

  if (supportedHubs && !supportedHubs.ok) {
    return NextResponse.json(
      { error: supportedHubs.error },
      { status: 400 },
    );
  }

  const { data: profile, error } = await access.supabase
    .from("cook_profiles")
    .update({
      display_name: displayName,
      bio,
      is_available: value.is_available,
      ...(supportedHubs?.ok
        ? { supported_hubs: supportedHubs.value }
        : {}),
    })
    .eq("user_id", access.auth.user.id)
    .select("display_name, bio, is_available, supported_hubs")
    .maybeSingle();

  if (error) {
    console.error("Cook profile update failed:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to save your cook profile." },
      { status: 500 },
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "Cook profile not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ profile });
}
