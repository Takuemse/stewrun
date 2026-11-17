
import {
  isAuthorizedCronRequest,
} from "@/lib/server/cron-auth.server";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(
    request,
    process.env.CRON_SECRET,
  )) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  return Response.json(
    { error: "EcoCash reconciliation is not enabled for the cash-only MVP." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
