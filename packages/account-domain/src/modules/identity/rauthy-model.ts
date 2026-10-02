import type { RauthyUpsertInput } from "@neuro/contracts";
import { z } from "zod";

import { BadRequestError, HttpError } from "@/platform/errors";

const claimString = z.string().regex(/^[^\u0000-\u001f\u007f]+$/);
export const rauthyUpsertSchema = z.object({
  issuer: claimString.min(1).max(2048),
  subject: claimString.min(1).max(255),
  username: claimString.max(128).trim().min(1).optional(),
  email: z.string().max(254).email().nullable().optional(),
  emailVerified: z.boolean().default(false),
}).strict().refine((claims) => !claims.emailVerified || Boolean(claims.email), {
  message: "Verified email requires an email claim",
  path: ["emailVerified"],
});

export function requireRauthyIssuer(environment: NodeJS.ProcessEnv = process.env): string {
  if (environment.AUTH_PROVIDER !== "rauthy") {
    throw new HttpError(503, "MODULE_DISABLED", "Rauthy authentication is disabled");
  }
  const issuer = environment.RAUTHY_ISSUER_URL;
  const invalid = () => new HttpError(503, "MODULE_DISABLED", "Invalid Rauthy issuer configuration");
  if (!issuer || issuer.length > 2048 || issuer.trim() !== issuer || /[\s\\]/.test(issuer)) {
    throw invalid();
  }
  let url: URL;
  try {
    url = new URL(issuer);
  } catch {
    throw invalid();
  }
  const syntheticLoopback = environment.RAUTHY_ALLOW_INSECURE_LOOPBACK === "true"
    && ["development", "test"].includes(environment.NODE_ENV ?? "")
    && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    && url.protocol === "http:";
  if ((url.protocol !== "https:" && !syntheticLoopback)
    || !url.hostname || url.username || url.password || url.search || url.hash
    || issuer.includes("?") || issuer.includes("#")) {
    throw invalid();
  }
  return issuer;
}

export function parseRauthyUpsertInput(input: unknown, environment: NodeJS.ProcessEnv = process.env): RauthyUpsertInput {
  const issuer = requireRauthyIssuer(environment);
  const parsed = rauthyUpsertSchema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestError("Invalid Rauthy identity claims");
  }
  if (parsed.data.issuer !== issuer) {
    throw new BadRequestError("Rauthy identity issuer mismatch");
  }
  return parsed.data;
}
