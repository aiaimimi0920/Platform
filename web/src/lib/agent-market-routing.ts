import type { TaskView } from "@neuro/contracts";

type TaskRouteMatchReason =
  | "preferred_capability"
  | "preferred_capability_miss"
  | "route_match"
  | "route_miss"
  | "route_missing";

export type RouteDescriptor = {
  code: string;
  title?: string | null;
  routingSummary?: string | null;
  routingTags?: string[] | null;
  publicTitle?: string | null;
  publicDescription?: string | null;
};

export type TaskRouteMatchResult = {
  accepted: boolean;
  score: number;
  matchedKeywords: string[];
  reason: TaskRouteMatchReason;
};

export function normalizeRouteKeyword(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || "";
}

export function splitRoutePhrases(value: string | null | undefined) {
  return (value ?? "")
    .split(/[\r\n,，\/|;；]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

export function normalizeRouteKeywords(values: string[] | null | undefined) {
  const seen = new Set<string>();
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length >= 2)
    .filter((value) => {
      const normalized = normalizeRouteKeyword(value);
      if (!normalized || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
}

export function buildTaskRouteHaystack(task: Pick<TaskView, "title" | "description" | "preferredCapabilityCodes">) {
  return normalizeRouteKeyword(
    [task.title, task.description, ...task.preferredCapabilityCodes].filter(Boolean).join(" "),
  );
}

export function buildRouteDescriptorKeywords(descriptor: RouteDescriptor) {
  return normalizeRouteKeywords([
    descriptor.code,
    ...(descriptor.title ? [descriptor.title] : []),
    ...(descriptor.publicTitle ? [descriptor.publicTitle] : []),
    ...(descriptor.routingTags ?? []),
    ...splitRoutePhrases(descriptor.routingSummary),
    ...splitRoutePhrases(descriptor.publicDescription),
  ]);
}

export function getTaskRouteMatch(
  task: Pick<TaskView, "title" | "description" | "preferredCapabilityCodes">,
  descriptor: RouteDescriptor,
): TaskRouteMatchResult {
  if (task.preferredCapabilityCodes.length > 0) {
    const preferredMatch = task.preferredCapabilityCodes.includes(descriptor.code);
    return {
      accepted: preferredMatch,
      score: preferredMatch ? 100 : 0,
      matchedKeywords: preferredMatch ? [descriptor.code] : [],
      reason: preferredMatch ? "preferred_capability" : "preferred_capability_miss",
    };
  }

  const haystack = buildTaskRouteHaystack(task);
  const keywords = buildRouteDescriptorKeywords(descriptor);
  if (!haystack || keywords.length === 0) {
    return {
      accepted: false,
      score: 0,
      matchedKeywords: [],
      reason: "route_missing",
    };
  }

  const matchedKeywords = keywords.filter((keyword) => haystack.includes(normalizeRouteKeyword(keyword)));
  return {
    accepted: matchedKeywords.length > 0,
    score: matchedKeywords.length,
    matchedKeywords,
    reason: matchedKeywords.length > 0 ? "route_match" : "route_miss",
  };
}
