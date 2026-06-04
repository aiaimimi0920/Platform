import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/env";
import { ConflictError } from "@/platform/errors";

function getBenefitServiceApiKeySecret() {
  const secret = env.benefitServiceApiKeySecret?.trim();
  if (!secret) {
    throw new ConflictError("当前环境尚未配置 new_api 访问密钥签发密钥。");
  }
  return secret;
}

function createBenefitServiceApiAccessSignature(args: {
  accessKeyId: string;
  serviceId: string;
  userId: string;
  secret: string;
}) {
  return createHmac("sha256", args.secret)
    .update(`${args.accessKeyId}:${args.serviceId}:${args.userId}`)
    .digest("base64url")
    .slice(0, 32);
}

export function buildBenefitServiceApiAccessKey(args: {
  accessKeyId: string;
  serviceId: string;
  userId: string;
  secret?: string;
}) {
  const secret = args.secret ?? getBenefitServiceApiKeySecret();
  const encodedId = Buffer.from(args.accessKeyId, "utf8").toString("base64url");
  const signature = createBenefitServiceApiAccessSignature({
    accessKeyId: args.accessKeyId,
    serviceId: args.serviceId,
    userId: args.userId,
    secret,
  });
  return `new_api_${encodedId}.${signature}`;
}

export function parseBenefitServiceApiAccessKey(rawToken: string | null | undefined) {
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
    const accessKeyId = Buffer.from(encodedId, "base64url").toString("utf8").trim();
    if (!accessKeyId || !signature) {
      return null;
    }
    return {
      token,
      accessKeyId,
      signature,
    };
  } catch {
    return null;
  }
}

export function verifyBenefitServiceApiAccessKey(
  token: string,
  args: {
    accessKeyId: string;
    serviceId: string;
    userId: string;
    secret?: string;
  },
) {
  const parsed = parseBenefitServiceApiAccessKey(token);
  if (!parsed || parsed.accessKeyId !== args.accessKeyId) {
    return false;
  }

  const secret = args.secret ?? getBenefitServiceApiKeySecret();
  const expectedSignature = createBenefitServiceApiAccessSignature({
    accessKeyId: args.accessKeyId,
    serviceId: args.serviceId,
    userId: args.userId,
    secret,
  });

  const providedBuffer = Buffer.from(parsed.signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function resolveBenefitServiceApiAccessPublicBaseUrl(fallbackUrl: string | null | undefined) {
  const configured = env.benefitServiceApiPublicBaseUrl?.trim();
  const candidate = configured || fallbackUrl?.trim() || "";
  if (!candidate) {
    throw new ConflictError("当前服务尚未配置 new_api 对外访问地址。");
  }
  return candidate.replace(/\/+$/, "");
}
