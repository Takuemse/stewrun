import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";
import { readRequestBody } from "@/lib/request-body";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, href, created_at, read_at")
    .eq("recipient_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Notification list lookup failed:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to load notifications." },
      { status: 500 },
    );
  }

  return NextResponse.json({ notifications: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await readRequestBody(request, 2_048);
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
      { error: "A notification ID or markAll action is required." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const updates = {
    read_at: new Date().toISOString(),
  };
  let query = supabase
    .from("notifications")
    .update(updates)
    .eq("recipient_id", auth.user.id)
    .is("read_at", null);

  if (value.markAll === true) {
    const { error } = await query;
    if (error) {
      console.error("Mark all notifications read failed:", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: "Unable to update notifications." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  }

  if (typeof value.id !== "string" || !UUID_PATTERN.test(value.id)) {
    return NextResponse.json(
      { error: "A valid notification ID is required." },
      { status: 400 },
    );
  }

  query = query.eq("id", value.id);
  const { data, error } = await query
    .select("id, title, message, href, created_at, read_at")
    .maybeSingle();

  if (error) {
    console.error("Mark notification read failed:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to update this notification." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Notification not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ notification: data });
}
