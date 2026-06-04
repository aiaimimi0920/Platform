import type {
  AgentExecutionCallbackAuditSummaryBucket,
  AgentExecutionCallbackAutoRemediationReasonCategory,
  AgentExecutionCallbackAutoRemediationReasonDisposition,
} from "@neuro/contracts";

const autoRemediationReasonPatternMap = {
  policy_disabled: ["disabled by agent policy"],
  missing_rejection_category: ["rejection category is unavailable"],
  policy_budget_exhausted: ["exhausted its retry budget"],
  missing_agent: ["linked agent is missing or no longer external"],
  missing_payload: ["stored payload replay is unavailable and fallback retry requests are disabled"],
  incompatible_payload: [
    "stored payload replay is incompatible with the current replay envelope",
    "stored payload replay is invalid and fallback retry requests are disabled",
  ],
  compatibility_policy_blocked: ["is not enabled by the current replay compatibility policy"],
  compat_window_blocked: [
    "the current replay compatibility policy blocks direct replay for that path",
    "the current policy prefers retry request over direct replay",
  ],
  policy_not_covered: ["does not cover rejection category", "cannot apply replay or fallback retry"],
  duplicate_cooldown: ["already recorded recently for this audit", "already replayed recently for this audit"],
  target_unavailable: [
    "callback audit not found",
    "agent execution not found",
    "external agent is disabled",
    "external agent callback secret is unavailable",
    "only rejected callback audits can replay stored payloads",
    "only external callback audits support stored payload replay",
    "only retryable rejected callbacks support stored payload replay",
    "only rejected callback audits can be marked for retry requests",
    "only external callback audits support retry requests",
    "external callback protocol version does not match agent configuration",
  ],
} as const satisfies Record<
  Exclude<AgentExecutionCallbackAutoRemediationReasonCategory, "attempt_failed">,
  string[]
>;

const orderedAutoRemediationReasonCategories = [
  "policy_disabled",
  "missing_rejection_category",
  "policy_budget_exhausted",
  "missing_agent",
  "missing_payload",
  "incompatible_payload",
  "compatibility_policy_blocked",
  "compat_window_blocked",
  "policy_not_covered",
  "duplicate_cooldown",
  "target_unavailable",
] as const satisfies ReadonlyArray<Exclude<AgentExecutionCallbackAutoRemediationReasonCategory, "attempt_failed">>;

const autoRemediationReasonDispositionMap = {
  policy_disabled: "skipped",
  missing_rejection_category: "skipped",
  policy_budget_exhausted: "skipped",
  missing_agent: "skipped",
  missing_payload: "skipped",
  incompatible_payload: "skipped",
  compatibility_policy_blocked: "skipped",
  compat_window_blocked: "skipped",
  policy_not_covered: "skipped",
  duplicate_cooldown: "skipped",
  target_unavailable: "skipped",
  attempt_failed: "failed",
} as const satisfies Record<
  AgentExecutionCallbackAutoRemediationReasonCategory,
  AgentExecutionCallbackAutoRemediationReasonDisposition
>;

const allAutoRemediationReasonCategories = [
  ...orderedAutoRemediationReasonCategories,
  "attempt_failed",
] as const satisfies ReadonlyArray<AgentExecutionCallbackAutoRemediationReasonCategory>;

function sortSummaryBuckets(rows: Array<{ key: string; count: number }>) {
  return rows
    .map((row) => ({ key: row.key, count: Number(row.count ?? 0) }))
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function getAutoRemediationReasonFilterPatterns(
  category: Exclude<AgentExecutionCallbackAutoRemediationReasonCategory, "attempt_failed">,
) {
  return autoRemediationReasonPatternMap[category];
}

export function listAutoRemediationReasonCategoriesForDisposition(
  disposition: AgentExecutionCallbackAutoRemediationReasonDisposition,
) {
  return allAutoRemediationReasonCategories.filter(
    (category) => autoRemediationReasonDispositionMap[category] === disposition,
  );
}

export function classifyAutoRemediationReasonCategory(
  message: string | null | undefined,
): AgentExecutionCallbackAutoRemediationReasonCategory | null {
  const normalized = message?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }

  for (const category of orderedAutoRemediationReasonCategories) {
    const patterns = autoRemediationReasonPatternMap[category];
    if (patterns.some((pattern) => normalized.includes(pattern))) {
      return category;
    }
  }

  return "attempt_failed";
}

export function getAutoRemediationReasonDisposition(
  category: AgentExecutionCallbackAutoRemediationReasonCategory | null | undefined,
): AgentExecutionCallbackAutoRemediationReasonDisposition | null {
  if (!category) {
    return null;
  }
  return autoRemediationReasonDispositionMap[category];
}

export function buildAutoRemediationReasonBuckets(
  rows: Array<{ key: string; count: number }>,
  disposition: AgentExecutionCallbackAutoRemediationReasonDisposition,
): AgentExecutionCallbackAuditSummaryBucket[] {
  const counts = new Map<AgentExecutionCallbackAutoRemediationReasonCategory, number>();

  for (const row of rows) {
    const category = classifyAutoRemediationReasonCategory(row.key === "none" ? null : row.key);
    if (!category || getAutoRemediationReasonDisposition(category) !== disposition) {
      continue;
    }
    counts.set(category, (counts.get(category) ?? 0) + Number(row.count ?? 0));
  }

  return sortSummaryBuckets(
    [...counts.entries()].map(([key, count]) => ({
      key,
      count,
    })),
  );
}
