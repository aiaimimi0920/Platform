import type {
  GatewayExecutionMode,
  GatewayProviderAdapter,
  GatewayRelayEndpointKind,
} from "./provider";

export const gatewayBrowserExecutorNodeStatuses = ["active", "degraded", "draining", "offline"] as const;

export type GatewayBrowserExecutorNodeStatus = (typeof gatewayBrowserExecutorNodeStatuses)[number];

export const gatewayBrowserCapabilitySlotStatuses = [
  "warming",
  "warm",
  "hot",
  "busy",
  "cooling",
  "expired",
  "dead",
] as const;

export type GatewayBrowserCapabilitySlotStatus = (typeof gatewayBrowserCapabilitySlotStatuses)[number];

export const gatewayBrowserExecutionStatuses = [
  "leased",
  "completed",
  "released",
  "challenge",
  "timed_out",
  "crashed",
] as const;

export type GatewayBrowserExecutionStatus = (typeof gatewayBrowserExecutionStatuses)[number];

export type GatewayBrowserExecutorNodeView = {
  nodeId: string;
  status: GatewayBrowserExecutorNodeStatus;
  capabilities: string[];
  lastHeartbeatAt: string;
  version: string | null;
  host: string | null;
};

export type GatewayBrowserCapabilitySlotView = {
  slotId: string;
  nodeId: string;
  providerAccountId: string;
  adapter: GatewayProviderAdapter | string;
  endpointKind: GatewayRelayEndpointKind | string;
  executionMode: GatewayExecutionMode;
  status: GatewayBrowserCapabilitySlotStatus;
  runtimeStateObjectKey: string | null;
  accountName: string | null;
  lastWarmAt: string | null;
  lastUsedAt: string | null;
  lastFailureAt: string | null;
  degradationReasons: string[] | null;
  updatedAt: string;
};

export type GatewayBrowserCapabilityLeaseView = {
  leaseId: string;
  slotId: string;
  nodeId: string;
  providerAccountId: string;
  requestAuditId: string | null;
  projectId: string | null;
  endpointKind: GatewayRelayEndpointKind | string;
  executionMode: GatewayExecutionMode;
  issuedAt: string;
  expiresAt: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
};

export type GatewayBrowserExecutorNodeHealthView = {
  nodeId: string;
  totalSlots: number;
  warmSlots: number;
  busySlots: number;
  coolingSlots: number;
  degradedSlots: number;
  challengeOpenSlots: number;
  lastErrorSummary: string | null;
  updatedAt: string;
};

export type GatewayBrowserExecutorProviderHealthView = {
  providerAccountId: string;
  totalSlots: number;
  warmSlots: number;
  busySlots: number;
  coolingSlots: number;
  degradedSlots: number;
  challengeOpenSlots: number;
  lastErrorSummary: string | null;
  updatedAt: string;
};

export type GatewayBrowserExecutorHealthView = {
  generatedAt: string;
  totalNodes: number;
  totalSlots: number;
  totalWarmSlots: number;
  totalBusySlots: number;
  totalCoolingSlots: number;
  totalDegradedSlots: number;
  totalChallengeOpenSlots: number;
  nodes: GatewayBrowserExecutorNodeHealthView[];
  providers: GatewayBrowserExecutorProviderHealthView[];
};
