import type {
  AgentExecutionCallbackAuditView,
  AgentExecutionOutputEnvelope,
  AgentExecutionRunView,
  AgentExecutionStepView,
  AgentExecutionView as ContractAgentExecutionView,
  AgentView as ContractAgentView,
  ItemManualReviewView,
  ItemView as ContractItemView,
  ProductListItem as ContractProductListItem,
} from "@neuro/contracts";

export type { ManualReviewWorkloadView } from "@neuro/contracts";
export type {
  AgentExecutionLaunchPresetView,
  CreateAgentExecutionLaunchPresetInput,
  DiscountCodeOperatorMutationResult,
  DiscountCodeBatchMutationResult,
  DiscountCodeOperatorView,
  DiscountCodeOperatorState,
  OrderView,
  ProductOperatorMutationResult,
  ProductOperatorView,
  ApplyDiscountCodeBatchInput,
  ListAgentExecutionLaunchPresetsInput,
  ListOperatorDiscountCodesInput,
  RollbackOrderInput,
  RollbackOrderResult,
  UpdateAgentExecutionLaunchPresetInput,
  UpsertDiscountCodeInput,
  UpsertProductInput,
} from "@neuro/contracts";

export type ItemUnitIssueReason = "invalidated" | "expired" | "quota_exhausted" | "normal_exhaustion";
export type ItemIssueReportOutcome = "replaced" | "rejected" | "manual_review";
export type ItemIssueRejectionCode =
  | "warranty_expired"
  | "reason_not_covered"
  | "manual_review_required"
  | "quota_exhausted_not_replaceable"
  | "normal_exhaustion_not_replaceable";
export type ItemReplacementLogTrigger = "issue_report" | "manual_reconcile" | "scheduled_reconcile" | "manual_review";
export type ItemFulfillmentRunTrigger = "manual" | "scheduled";
export type ItemFulfillmentRunStatus = "completed" | "noop";

export type AgentView = ContractAgentView & {
  externalCallbackRotatedAt?: string | null;
  externalCallbackProtocolVersion?: number | null;
  externalCallbackSecretVersion?: number | null;
  externalCallbackPreviousSecretVersion?: number | null;
  externalCallbackSecretGraceUntil?: string | null;
  externalCallbackPreviousProtocolVersion?: number | null;
  externalCallbackProtocolGraceUntil?: string | null;
};

export type AgentExecutionView = ContractAgentExecutionView & {
  lastHeartbeatAt?: string | null;
  lastExternalCallbackAt?: string | null;
  steps?: AgentExecutionStepView[];
  callbacks?: AgentExecutionCallbackAuditView[];
  runs?: AgentExecutionRunView[];
  canRequeue?: boolean | null;
  output?: AgentExecutionOutputEnvelope | null;
};

export type ItemUnitView = {
  id: string;
  code: string;
  status: "active" | "inactive" | "replaced" | "consumed";
  issueReason: ItemUnitIssueReason | null;
  activatedAt: string | null;
  expiresAt: string | null;
  replacedByUnitId: string | null;
};

export type ItemIssueReportView = {
  id: string;
  itemId: string;
  unitId: string;
  reason: ItemUnitIssueReason;
  outcome: ItemIssueReportOutcome;
  rejectionCode: ItemIssueRejectionCode | null;
  rejectionCategory: "manual_review" | "warranty_window" | "policy_restriction" | "usage_exhaustion" | null;
  rejectionSummary: string | null;
  operatorHint: string | null;
  appealable: boolean;
  replacementUnitId: string | null;
  createdAt: string;
};

export type ItemReplacementLogView = {
  id: string;
  itemId: string;
  previousUnitId: string | null;
  replacementUnitId: string;
  reason: ItemUnitIssueReason | null;
  trigger: ItemReplacementLogTrigger;
  createdAt: string;
};

export type ItemFulfillmentRunView = {
  id: string;
  itemId: string;
  trigger: ItemFulfillmentRunTrigger;
  status: ItemFulfillmentRunStatus;
  scannedUnits: number;
  replacementsCreated: number;
  note: string | null;
  createdAt: string;
};

export type ProductListItem = ContractProductListItem & {
  unitCount?: number | null;
  warrantyDays?: number | null;
};

export type ItemView = ContractItemView & {
  totalUnits?: number | null;
  activeUnits?: number | null;
  replacementCount?: number | null;
  warrantyExpiresAt?: string | null;
  issueReportingEnabled?: boolean;
  units?: ItemUnitView[];
  issueReports?: ItemIssueReportView[];
  manualReviews?: ItemManualReviewView[];
  replacementLogs?: ItemReplacementLogView[];
  fulfillmentRuns?: ItemFulfillmentRunView[];
  lastReconciledAt?: string | null;
};

export type RotateAgentCallbackSecretResult = {
  agent: AgentView;
  callbackSecret: string;
};
