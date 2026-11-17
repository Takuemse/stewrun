import { NextResponse } from "next/server";

import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/lib/supabase/auth.server";
import { readRequestBody } from "@/lib/request-body";

const MAX_MENU_BODY_BYTES = 8_192;

type MenuInput = {
  name: string;
  description: string | null;
  price: number;
  available: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function validateMenuInput(value: unknown):
  | { ok: true; value: MenuInput }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Enter valid offering details." };
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const description =
    value.description === null
      ? null
      : typeof value.description === "string"
        ? value.description.trim() || null
        : undefined;
  const price = value.price;

  if (name.length < 2 || name.length > 150) {
    return {
      ok: false,
      error: "Offering names must contain between 2 and 150 characters.",
    };
  }

  if (
    description === undefined ||
    (description !== null && description.length > 500)
  ) {
    return {
      ok: false,
      error: "Descriptions must be 500 characters or fewer.",
    };
  }

  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price <= 0 ||
    price > 99_999_999.99 ||
    Math.abs(price * 100 - Math.round(price * 100)) > 0.000001
  ) {
    return {
      ok: false,
      error: "Enter a positive price with no more than two decimal places.",
    };
  }

  if (typeof value.available !== "boolean") {
    return { ok: false, error: "Choose whether to publish this offering." };
  }

  return {
    ok: true,
    value: { name, description, price, available: value.available },
  };
}

async function readJsonBody(request: Request): Promise<
  | { ok: true; value: unknown }
  | { ok: false; error: string; status: number }
> {
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    const size = Number(contentLength);

    if (!Number.isSafeInteger(size) || size < 0) {
      return { ok: false, error: "Invalid request body size.", status: 400 };
    }

    if (size > MAX_MENU_BODY_BYTES) {
      return { ok: false, error: "Request body is too large.", status: 413 };
    }
  }

  const body = await readRequestBody(request, MAX_MENU_BODY_BYTES);

  if (!body.ok) {
    return body.reason === "too_large"
      ? { ok: false, error: "Request body is too large.", status: 413 }
      : { ok: false, error: "Could not read request body.", status: 400 };
  }

  try {
    return { ok: true, value: JSON.parse(body.text) as unknown };
  } catch {
    return { ok: false, error: "Invalid JSON request body.", status: 400 };
  }
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

export async function GET(request: Request) {
  const access = await authenticateCook();
  if ("response" in access) return access.response;

  const manage = new URL(request.url).searchParams.get("manage") === "1";
  let query = access.supabase
    .from("menu_items")
    .select("id, name, description, price, available")
    .eq("cook_id", access.auth.user.id)
    .order("name", { ascending: true });

  if (!manage) {
    query = query.eq("available", true);
  }

  const { data: menu, error } = await query;

  if (error) {
    console.error("Cook menu lookup failed:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to retrieve your menu items." },
      { status: 500 },
    );
  }

  return NextResponse.json({ menu: menu ?? [] });
}

export async function POST(request: Request) {
  const access = await authenticateCook();
  if ("response" in access) return access.response;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const validation = validateMenuInput(body.value);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data, error } = await access.supabase
    .from("menu_items")
    .insert({
      cook_id: access.auth.user.id,
      ...validation.value,
    })
    .select("id, name, description, price, available")
    .single();

  if (error) {
    console.error("Cook offering creation failed:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to save this offering." },
      { status: 500 },
    );
  }

  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await authenticateCook();
  if ("response" in access) return access.response;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  if (
    !isRecord(body.value) ||
    typeof body.value.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.value.id,
    )
  ) {
    return NextResponse.json(
      { error: "A valid offering ID is required." },
      { status: 400 },
    );
  }

  const validation = validateMenuInput(body.value);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data, error } = await access.supabase
    .from("menu_items")
    .update(validation.value)
    .eq("id", body.value.id)
    .eq("cook_id", access.auth.user.id)
    .select("id, name, description, price, available")
    .maybeSingle();

  if (error) {
    console.error("Cook offering update failed:", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to update this offering." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Offering not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ item: data });
}
