import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

function sameSecret(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

/**
 * Protects the administrative API with the server-side access key.
 *
 * There is intentionally no development bypass. A missing key must fail
 * closed in every environment so an accidentally exposed preview cannot
 * mutate operational data.
 */
export const requireAdminAccess: RequestHandler = (request, response, next) => {
  const configuredKey = process.env.ADMIN_ACCESS_KEY;

  if (!configuredKey) {
    request.log.error("Admin access is not configured");
    response.status(503).json({ error: "Admin access is not configured" });
    return;
  }

  const providedKey = request.header("x-admin-access-key") ?? "";
  if (!sameSecret(providedKey, configuredKey)) {
    request.log.warn("Rejected admin access attempt");
    response.status(401).json({ error: "Admin access key is invalid" });
    return;
  }

  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  next();
};