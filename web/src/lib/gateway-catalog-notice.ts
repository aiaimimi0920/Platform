export type GatewayCatalogUnavailableNotice = {
  title: string;
  body: string;
  detail: string;
  badgeLabel?: string;
  badgeTone?: "warning" | "danger";
};

type GatewayDependencyUnavailableNoticeInput = {
  resourceName: string;
  continuation: string;
  gatewayInternalUrl?: string;
};

const defaultGatewayInternalUrl = "http://127.0.0.1:4200";
const networkFailureCodes = new Set(["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ETIMEDOUT"]);

function resolveGatewayInternalUrl(gatewayInternalUrl?: string) {
  const trimmed = gatewayInternalUrl?.trim();
  return trimmed || process.env.AI_GATEWAY_INTERNAL_URL?.trim() || defaultGatewayInternalUrl;
}

function getReadableErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.trim();
  }

  if (typeof error === "string") {
    return error.trim();
  }

  return "";
}

function isNetworkLikeGatewayFailure(error: unknown, rawMessage: string) {
  if (!(error instanceof Error)) {
    return true;
  }

  const cause = error.cause as { code?: string } | undefined;
  if (typeof cause?.code === "string" && networkFailureCodes.has(cause.code)) {
    return true;
  }

  return /fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET|EHOSTUNREACH|ETIMEDOUT/i.test(rawMessage);
}

export function buildGatewayCatalogUnavailableNotice(
  error: unknown,
  gatewayInternalUrl?: string,
): GatewayCatalogUnavailableNotice {
  return buildGatewayDependencyUnavailableNotice(error, {
    resourceName: "Gateway bundle 目录",
    continuation: "商品库存和优惠码管理仍可继续使用。",
    gatewayInternalUrl,
  });
}

export function buildGatewayDependencyUnavailableNotice(
  error: unknown,
  input: GatewayDependencyUnavailableNoticeInput,
): GatewayCatalogUnavailableNotice {
  const internalUrl = resolveGatewayInternalUrl(input.gatewayInternalUrl);
  const rawMessage = getReadableErrorMessage(error);
  const rawErrorDetail = rawMessage ? `原始错误：${rawMessage}` : "未收到可读的底层错误。";

  if (!isNetworkLikeGatewayFailure(error, rawMessage)) {
    return {
      title: "AI Gateway 返回数据异常",
      body: `${input.resourceName}暂不可用；${input.continuation}`,
      detail: `AI Gateway 已响应，但${input.resourceName}接口返回错误；请检查 Gateway 日志、数据库 schema 或迁移状态。${rawErrorDetail}`,
      badgeLabel: "Gateway 接口异常",
      badgeTone: "danger",
    };
  }

  return {
    title: "AI Gateway 内部服务未连接",
    body: `${input.resourceName}暂不可用；${input.continuation}`,
    detail: `请检查 AI_GATEWAY_INTERNAL_URL=${internalUrl} 或启动 AI Gateway 服务。${rawErrorDetail}`,
    badgeLabel: "依赖服务未连接",
    badgeTone: "warning",
  };
}
