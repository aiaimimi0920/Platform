import type { CreateTaskDraftInput } from "@neuro/contracts";

export type NormalizedTaskDraftInput = {
  title: string;
  description: string;
  preferredCapabilityCodes: string[];
  idempotencyKey: string;
};

export type TaskDraftRecord = {
  id: string;
  creatorUserId: string;
  assignedUserId: null;
  title: string;
  description: string;
  preferredCapabilityCodes: string[];
  pricingMode: "flat_task";
  billingUnit: null;
  meterKey: null;
  meterQuantity: null;
  operationMode: "manual";
  rewardCurrency: "obsidian";
  rewardAmount: 0;
  requiredBondAmount: 0;
  status: "draft";
  idempotencyKey: string;
  createdAt: Date;
};

function requireText(value: string, field: string, maximum: number) {
  const normalized = value?.trim() ?? "";
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > maximum) throw new Error(`${field} exceeds ${maximum} characters`);
  return normalized;
}

function normalizeCapabilityCodes(values: string[] | undefined) {
  const seen = new Set<string>();
  return (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

export function normalizeTaskDraftInput(input: CreateTaskDraftInput): NormalizedTaskDraftInput {
  return {
    title: requireText(input.title, "Task draft title", 200),
    description: requireText(input.description, "Task draft description", 100_000),
    preferredCapabilityCodes: normalizeCapabilityCodes(input.preferredCapabilityCodes),
    idempotencyKey: requireText(input.idempotencyKey, "Task draft idempotency key", 500),
  };
}

export function buildTaskDraftRecord(args: {
  id: string;
  ownerUserId: string;
  input: NormalizedTaskDraftInput;
  createdAt: Date;
}): TaskDraftRecord {
  return {
    id: args.id,
    creatorUserId: args.ownerUserId,
    assignedUserId: null,
    title: args.input.title,
    description: args.input.description,
    preferredCapabilityCodes: [...args.input.preferredCapabilityCodes],
    pricingMode: "flat_task",
    billingUnit: null,
    meterKey: null,
    meterQuantity: null,
    operationMode: "manual",
    rewardCurrency: "obsidian",
    rewardAmount: 0,
    requiredBondAmount: 0,
    status: "draft",
    idempotencyKey: args.input.idempotencyKey,
    createdAt: args.createdAt,
  };
}

export function taskDraftPayloadMatches(
  record: {
    title: string;
    description: string;
    preferredCapabilityCodes: string[];
    idempotencyKey: string | null;
    status: string;
  },
  input: NormalizedTaskDraftInput,
) {
  return (
    record.status === "draft" &&
    record.idempotencyKey === input.idempotencyKey &&
    record.title === input.title &&
    record.description === input.description &&
    JSON.stringify(record.preferredCapabilityCodes) === JSON.stringify(input.preferredCapabilityCodes)
  );
}
