import { isRedirectError } from "next/dist/client/components/redirect-error";

type ActionValidationIssue = {
  code?: string;
  message?: string;
  minimum?: number;
  maximum?: number;
  path?: unknown[];
};

function formatActionValidationIssueMessage(issue: ActionValidationIssue): string | null {
  const field = Array.isArray(issue.path) ? String(issue.path[0] ?? "") : "";
  const code = issue.code ?? "";

  if (field === "title") {
    if (code === "too_small") {
      return `议题标题至少需要 ${issue.minimum ?? 4} 个字。`;
    }
    if (code === "too_big") {
      return `议题标题最多只能输入 ${issue.maximum ?? 120} 个字。`;
    }
  }

  if (field === "description") {
    if (code === "too_small") {
      return `详细描述至少需要 ${issue.minimum ?? 16} 个字。`;
    }
    if (code === "too_big") {
      return `详细描述最多只能输入 ${issue.maximum ?? 4000} 个字。`;
    }
  }

  if (field === "tag") {
    return "请选择 1 个标签。";
  }

  if (field === "content") {
    if (code === "too_small") {
      return "讨论内容不能为空。";
    }
    if (code === "too_big") {
      return `讨论内容最多只能输入 ${issue.maximum ?? 1200} 个字。`;
    }
  }

  return typeof issue.message === "string" && issue.message.trim().length > 0 ? issue.message : null;
}

function normalizeActionErrorMessage(rawMessage: string): string | null {
  const trimmed = rawMessage.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const messages = parsed
      .map((entry) =>
        typeof entry === "object" && entry !== null ? formatActionValidationIssueMessage(entry as ActionValidationIssue) : null,
      )
      .filter((entry): entry is string => Boolean(entry && entry.trim().length > 0));

    if (messages.length === 0) {
      return null;
    }

    return Array.from(new Set(messages)).join(" ");
  } catch {
    return null;
  }
}

export function toMessage(error: unknown, fallback: string) {
  if (isRedirectError(error)) {
    throw error;
  }
  if (error instanceof Error && error.message) {
    return normalizeActionErrorMessage(error.message) ?? error.message;
  }
  return fallback;
}

export function resolveRedirectPath(value: FormDataEntryValue | null, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

export function appendQueryStringToRedirectTarget(redirectTo: string, params: URLSearchParams) {
  const hashIndex = redirectTo.indexOf("#");
  const base = hashIndex >= 0 ? redirectTo.slice(0, hashIndex) : redirectTo;
  const hash = hashIndex >= 0 ? redirectTo.slice(hashIndex) : "";
  return `${base}${base.includes("?") ? "&" : "?"}${params.toString()}${hash}`;
}

export function setRedirectTargetQueryParams(
  redirectTo: string,
  entries: Record<string, string | null | undefined>,
) {
  const hashIndex = redirectTo.indexOf("#");
  const base = hashIndex >= 0 ? redirectTo.slice(0, hashIndex) : redirectTo;
  const hash = hashIndex >= 0 ? redirectTo.slice(hashIndex) : "";
  const queryIndex = base.indexOf("?");
  const pathname = queryIndex >= 0 ? base.slice(0, queryIndex) : base;
  const params = new URLSearchParams(queryIndex >= 0 ? base.slice(queryIndex + 1) : "");

  for (const [key, value] of Object.entries(entries)) {
    if (value && value.trim().length > 0) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function buildStatusRedirect(redirectTo: string, status: "success" | "error", message: string) {
  return appendQueryStringToRedirectTarget(redirectTo, new URLSearchParams({ status, message }));
}

export function appendQueryParams(redirectTo: string, entries: Record<string, string>) {
  return appendQueryStringToRedirectTarget(redirectTo, new URLSearchParams(entries));
}

export function parseBooleanFormValue(value: FormDataEntryValue | null, fallback = false) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

export function parseNullablePositiveIntFormValue(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("请输入有效的正整数参数。");
  }
  return Math.floor(parsed);
}

export function parsePositiveIntFormValue(value: FormDataEntryValue | null, fieldLabel: string) {
  const parsed = parseNullablePositiveIntFormValue(value);
  if (parsed === null) {
    throw new Error(`请输入有效的${fieldLabel}。`);
  }
  return parsed;
}

export function parseNullableIsoDateTimeFormValue(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("请输入有效的时间。");
  }
  return parsed.toISOString();
}

export function parseNullableQuotaValue(formData: FormData, modeField: string, valueField: string) {
  const mode = String(formData.get(modeField) || "leave").trim();
  if (mode === "leave") {
    return undefined;
  }
  if (mode === "clear") {
    return null;
  }
  return parsePositiveIntFormValue(formData.get(valueField), valueField);
}

export function parseOptionalJsonRecord(value: FormDataEntryValue | null, fieldLabel: string) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldLabel} 不是合法 JSON。`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} 需要是 JSON 对象。`);
  }
  return parsed as Record<string, unknown>;
}
