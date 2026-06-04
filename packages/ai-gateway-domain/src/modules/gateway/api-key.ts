import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/env";
import { ConflictError } from "@neuro/backend-foundation/platform/errors";

function getGatewayApiKeySecret() {
  const secret = env.apiKeySecret?.trim();
  if (!secret) {
    throw new ConflictError("当前环境尚未配置 AI gateway 访问密钥签发密钥。");
  }
  return secret;
}

function createGatewayApiKeySignature(args: {
  apiKeyId: string;
  projectId: string;
  tenantId: string;
  secret: string;
}) {
  return createHmac("sha256", args.secret)
    .update(`${args.apiKeyId}:${args.projectId}:${args.tenantId}`)
    .digest("base64url")
    .slice(0, 32);
}

export function buildGatewayProjectApiKey(args: {
  apiKeyId: string;
  projectId: string;
  tenantId: string;
  secret?: string;
}) {
  const secret = args.secret ?? getGatewayApiKeySecret();
  const encodedId = Buffer.from(args.apiKeyId, "utf8").toString("base64url");
  const signature = createGatewayApiKeySignature({
    apiKeyId: args.apiKeyId,
    projectId: args.projectId,
    tenantId: args.tenantId,
    secret,
  });
  return `new_api_${encodedId}.${signature}`;
}

export function parseGatewayProjectApiKey(rawToken: string | null | undefined) {
  const token = rawToken?.trim() ?? "";
  if (!token.startsWith("new_api_")) {
    return null;
  }

  const body = token.slice("new_api_".length);
  const delimiterIndex = body.indexOf(".");
  if (delimiterIndex <= 0 || delimiterIndex === body.length - 1) {
    return null;
  }

  const encodedId = body.slice(0, delimiterIndex);
  const signature = body.slice(delimiterIndex + 1);

  try {
    const apiKeyId = Buffer.from(encodedId, "base64url").toString("utf8").trim();
    if (!apiKeyId || !signature) {
      return null;
    }
    return {
      token,
      apiKeyId,
      signature,
    };
  } catch {
    return null;
  }
}

export function verifyGatewayProjectApiKey(
  token: string,
  args: {
    apiKeyId: string;
    projectId: string;
    tenantId: string;
    secret?: string;
  },
) {
  const parsed = parseGatewayProjectApiKey(token);
  if (!parsed || parsed.apiKeyId !== args.apiKeyId) {
    return false;
  }

  const secret = args.secret ?? getGatewayApiKeySecret();
  const expectedSignature = createGatewayApiKeySignature({
    apiKeyId: args.apiKeyId,
    projectId: args.projectId,
    tenantId: args.tenantId,
    secret,
  });

  const providedBuffer = Buffer.from(parsed.signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function resolveGatewayPublicBaseUrl(fallbackUrl?: string | null) {
  const candidate = env.publicBaseUrl?.trim() || fallbackUrl?.trim() || "";
  if (!candidate) {
    throw new ConflictError("当前环境尚未配置 AI gateway 对外访问地址。");
  }
  return candidate.replace(/\/+$/, "");
}

export function resolveGatewayCompatibilityBaseUrl(fallbackUrl?: string | null) {
  const candidate = env.compatibilityBaseUrl?.trim() || fallbackUrl?.trim() || "";
  return candidate ? candidate.replace(/\/+$/, "") : null;
}
