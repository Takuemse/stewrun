
import { timingSafeEqual } from "node:crypto";

export function isAuthorizedCronRequest(
  request: Request,
  secret: string | undefined,
): boolean {
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const received = Buffer.from(authorization, "utf8");

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}
