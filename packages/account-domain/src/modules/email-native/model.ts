import type {
  CreateAgentExecutionInput,
  CreateTaskInput,
  EmailNativeRouteKind,
} from "@neuro/contracts";

export type ParsedEmailNativeRoute =
  | {
      kind: "agent_execution";
      agentId: string;
      rawLocalPart: string;
    }
  | {
      kind: "task_create";
      rawLocalPart: string;
    };

export type ParsedEmailNativeStructuredContent = {
  metadata: Record<string, string>;
  content: string;
};

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

export function extractEmailNativeRoute(toEmail: string, ingressDomain: string): ParsedEmailNativeRoute | null {
  const normalizedToEmail = normalizeEmailAddress(toEmail);
  const [localPart = "", domain = ""] = normalizedToEmail.split("@");
  if (!localPart || !domain || domain !== normalizeEmailAddress(ingressDomain)) {
    return null;
  }

  if (localPart === "task" || localPart.startsWith("task+")) {
    return {
      kind: "task_create",
      rawLocalPart: localPart,
    };
  }

  if (localPart.startsWith("agent+")) {
    const [, rawAgentId = ""] = localPart.split("+", 2);
    const agentId = rawAgentId.trim();
    if (!agentId) {
      return null;
    }
    return {
      kind: "agent_execution",
      agentId,
      rawLocalPart: localPart,
    };
  }

  return null;
}

export function parseEmailNativeStructuredContent(textBody: string): ParsedEmailNativeStructuredContent {
  const normalizedBody = textBody.replace(/\r\n/g, "\n").trim();
  if (!normalizedBody) {
    return {
      metadata: {},
      content: "",
    };
  }

  const lines = normalizedBody.split("\n");
  const metadata: Record<string, string> = {};
  let contentStartIndex = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();
    if (!line) {
      contentStartIndex = index + 1;
      break;
    }
    if (line === "---") {
      contentStartIndex = index + 1;
      break;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      contentStartIndex = 0;
      return {
        metadata: {},
        content: normalizedBody,
      };
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(key)) {
      contentStartIndex = 0;
      return {
        metadata: {},
        content: normalizedBody,
      };
    }
    metadata[key] = value;
    contentStartIndex = index + 1;
  }

  const content = lines.slice(contentStartIndex).join("\n").trim();
  return {
    metadata,
    content,
  };
}

function readOptionalInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.floor(parsed));
}

function readOptionalString(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function buildEmailNativeAgentExecutionInput(args: {
  route: Extract<ParsedEmailNativeRoute, { kind: "agent_execution" }>;
  subject: string | null;
  textBody: string;
}): CreateAgentExecutionInput {
  const parsed = parseEmailNativeStructuredContent(args.textBody);
  const title = readOptionalString(parsed.metadata.title) || readOptionalString(args.subject ?? "") || `邮件调用 ${args.route.agentId}`;
  const objective = parsed.content || readOptionalString(args.subject ?? "") || "";

  const input: CreateAgentExecutionInput = {
    agentId: args.route.agentId,
    title,
    objective,
  };

  const capabilityId = readOptionalString(parsed.metadata.capabilityId);
  if (capabilityId) {
    input.capabilityId = capabilityId;
  }

  const runtimeProfileKey = readOptionalString(parsed.metadata.runtimeProfileKey);
  if (
    runtimeProfileKey === "baseline" ||
    runtimeProfileKey === "iterative" ||
    runtimeProfileKey === "deep_runtime"
  ) {
    input.runtimeProfileKey = runtimeProfileKey;
  }

  return input;
}

export function buildEmailNativeTaskInput(args: {
  subject: string | null;
  textBody: string;
  defaults: {
    rewardCurrency: Extract<CreateTaskInput["rewardCurrency"], "obsidian" | "mira">;
    rewardAmount: number;
    requiredBondAmount: number;
    pricingMode: NonNullable<CreateTaskInput["pricingMode"]>;
    operationMode: NonNullable<CreateTaskInput["operationMode"]>;
  };
}): CreateTaskInput {
  const parsed = parseEmailNativeStructuredContent(args.textBody);
  const preferredCapabilityCodes = (parsed.metadata.preferredCapabilityCodes ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const rewardCurrency = readOptionalString(parsed.metadata.rewardCurrency);
  const pricingMode = readOptionalString(parsed.metadata.pricingMode);
  const operationMode = readOptionalString(parsed.metadata.operationMode);

  return {
    title: readOptionalString(parsed.metadata.title) || readOptionalString(args.subject ?? "") || "邮件任务",
    description: parsed.content || readOptionalString(args.subject ?? "") || "",
    preferredCapabilityCodes: preferredCapabilityCodes.length > 0 ? preferredCapabilityCodes : undefined,
    pricingMode:
      pricingMode === "flat_task" || pricingMode === "token_metered" || pricingMode === "property_metered"
        ? pricingMode
        : args.defaults.pricingMode,
    billingUnit: readOptionalString(parsed.metadata.billingUnit) ?? null,
    meterKey: readOptionalString(parsed.metadata.meterKey) ?? null,
    meterQuantity: parsed.metadata.meterQuantity
      ? Math.max(1, readOptionalInteger(parsed.metadata.meterQuantity, 1))
      : null,
    operationMode:
      operationMode === "manual" || operationMode === "automatic"
        ? operationMode
        : args.defaults.operationMode,
    rewardCurrency: rewardCurrency === "obsidian" || rewardCurrency === "mira"
      ? rewardCurrency
      : args.defaults.rewardCurrency,
    rewardAmount: Math.max(1, readOptionalInteger(parsed.metadata.rewardAmount, args.defaults.rewardAmount)),
    requiredBondAmount: readOptionalInteger(parsed.metadata.requiredBondAmount, args.defaults.requiredBondAmount),
  };
}

export function getEmailNativeRouteKindLabel(routeKind: EmailNativeRouteKind | null) {
  if (routeKind === "agent_execution") {
    return "智能体调用";
  }
  if (routeKind === "task_create") {
    return "任务创建";
  }
  return "未知入口";
}
