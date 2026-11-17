import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth.server";

export async function POST() {
  const auth = await getAuthenticatedUser();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  if (auth.role !== "customer") {
    return NextResponse.json(
      { error: "Customer access required." },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      error:
        "Counteroffers are paused. Compare the cooks’ independent offers and choose one that works for you.",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
