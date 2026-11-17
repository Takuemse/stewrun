export function ecoCashPaymentsUnavailableResponse(): Response {
  return Response.json(
    {
      error:
        "EcoCash payments are not available yet. Pay your cook directly in cash at pickup when your order is marked for cash payment.",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
