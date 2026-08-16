import Link from "next/link";

import type {
  AgentCallbackConfigHistoryView,
  AgentCallbackHealthSummaryView,
  AgentCapabilityView,
  AgentExecutionStatus,
  AgentRecentCallbackView,
  AgentCallbackRemediationPolicyView,
} from "@neuro/contracts";
import { DependencyState } from "@/components/dependency-state";
import {
  NtBadge as Badge,
  NtInput as Input,
  NtSelect as Select,
} from "@/components/nt-primitives";
import {
  buildAgentCallbackPolicyRecommendation,
  formatAgentCallbackPolicyLabel,
  formatAgentCallbackReplayCompatibilityPolicy,
  formatAgentCallbackReplayFallbackProfile,
} from "@/lib/agent-callback-policies";
import {
  EXECUTION_STATUS_ORDER,
  buildAgentCallbackOpsHref,
  buildAgentsOpsHref,
  callbackHistoryChangeLabel,
  callbackWindowStateLabel,
  formatAgentSourceType,
  formatCount,
  formatRate,
  formatShanghaiDateTime,
} from "@/lib/agent-ops-presentation";
import {
  buildCallbackHealthRecommendations,
  callbackRecommendationToneLabel,
} from "@/lib/agent-ops-playbooks";
import type { AgentView } from "@/lib/core-client";
import type { DependencyResult } from "@/lib/dependency-result";
import {
  rotateAgentCallbackSecretAction,
  updateAgentCallbackProtocolVersionAction,
  updateAgentCallbackRemediationPolicyAction,
} from "@/lib/platform-actions";
import { renderCallbackFollowUpFields } from "./agent-ops-form-fields";
import {
  buildSelectedRecentCallbackAuditItem,
  statusBadgeVariant,
} from "./item-builders";
import {
  type AgentRecommendationItem,
  type DetailListRow,
  type FocusMetricItem,
  SelectedAgentCallbackHealthCard,
  SelectedAgentExternalGovernanceCard,
  SelectedAgentNoticeCard,
  SelectedAgentOverviewCard,
  SelectedAgentPolicyRecommendationCard,
  SelectedAgentRecentCallbacksCard,
  SelectedAgentControlCard,
  SelectedAgentTimelineCard,
  type TimelineItem,
} from "./sections";

type AgentCallbackSecretFlash = {
  agentId: string;
  callbackSecret: string;
};

export function SelectedAgentGovernanceSection(props: {
  agentExecutionsDependency?: DependencyResult<unknown>;
  agentExecutionsUnavailable: boolean;
  callbackHealthDependency?: DependencyResult<unknown>;
  callbackHealthUnavailable: boolean;
  callbackSecretFlash: AgentCallbackSecretFlash | null;
  currentOpsHref: string;
  executionPoolCount: number;
  executionStatusCounts: Record<AgentExecutionStatus, number>;
  policyCatalog: AgentCallbackRemediationPolicyView[];
  policyKeyFilter: string;
  query: string;
  recentCallbacksReturnHref: string;
  remediationPolicies: AgentCallbackRemediationPolicyView[];
  remediationPoliciesDependency?: DependencyResult<unknown>;
  remediationPoliciesUnavailable: boolean;
  selectedAgent: AgentView;
  selectedCallbackHistory: AgentCallbackConfigHistoryView[];
  selectedCallbackHistoryDependency?: DependencyResult<unknown>;
  selectedCallbackHistoryUnavailable: boolean;
  selectedCapabilities: AgentCapabilityView[];
  selectedCapabilityUnavailable: boolean;
  selectedHealth: AgentCallbackHealthSummaryView | null;
  selectedRecentCallbackAudits: AgentRecentCallbackView[];
  selectedRecentCallbacksDependency?: DependencyResult<unknown>;
  selectedRecentCallbacksUnavailable: boolean;
  sourceTypeFilter: string;
}) {
  const {
    agentExecutionsDependency,
    agentExecutionsUnavailable,
    callbackHealthDependency,
    callbackHealthUnavailable,
    callbackSecretFlash,
    currentOpsHref,
    executionPoolCount,
    executionStatusCounts,
    policyCatalog,
    policyKeyFilter,
    query,
    recentCallbacksReturnHref,
    remediationPolicies,
    remediationPoliciesDependency,
    remediationPoliciesUnavailable,
    selectedAgent,
    selectedCallbackHistory,
    selectedCallbackHistoryDependency,
    selectedCallbackHistoryUnavailable,
    selectedCapabilities,
    selectedCapabilityUnavailable,
    selectedHealth,
    selectedRecentCallbackAudits,
    selectedRecentCallbacksDependency,
    selectedRecentCallbacksUnavailable,
    sourceTypeFilter,
  } = props;

  const callbackPolicyRecommendation =
    !callbackHealthUnavailable && !remediationPoliciesUnavailable
      ? buildAgentCallbackPolicyRecommendation(selectedAgent, selectedHealth)
      : null;
  const callbackRecommendations = !callbackHealthUnavailable
    ? buildCallbackHealthRecommendations(selectedAgent.id, selectedHealth)
    : [];

  const selectedOverviewFocusMetrics: FocusMetricItem[] = [
    {
      label: "能力",
      value: selectedCapabilityUnavailable ? "—" : formatCount(selectedCapabilities.length),
    },
    {
      label: "执行",
      value: agentExecutionsUnavailable ? "—" : formatCount(executionPoolCount),
    },
    {
      label: "被拒绝",
      value: callbackHealthUnavailable ? "—" : formatCount(selectedHealth?.rejectedCallbacks ?? 0),
    },
    {
      label: "策略",
      value: selectedAgent.externalCallbackRemediationPolicyKey ?? "默认",
    },
  ];
  const selectedOverviewDetailRows: DetailListRow[] = [
    {
      label: "归属",
      value: selectedAgent.ownerUserId,
    },
    {
      label: "来源 / 鉴权",
      value: `${formatAgentSourceType(selectedAgent.sourceType)} / ${selectedAgent.authMode}`,
    },
    {
      label: "运行地址",
      value: selectedAgent.runtimeEndpoint || "未配置",
    },
    {
      label: "创建 / 更新",
      value: (
        <>
          {formatShanghaiDateTime(selectedAgent.createdAt)} /{" "}
          {formatShanghaiDateTime(selectedAgent.updatedAt)}
        </>
      ),
    },
    {
      label: "描述",
      value: selectedAgent.description || "暂无描述",
    },
  ];
  const selectedOverviewStatusActions = !agentExecutionsUnavailable ? (
    <>
      {EXECUTION_STATUS_ORDER.map((status) => (
        <Link
          href={buildAgentsOpsHref({
            agentId: selectedAgent.id,
            executionStatus: status,
            policyKey: policyKeyFilter,
            q: query,
            sourceType: sourceTypeFilter,
          })}
          key={status}
        >
          <Badge variant={statusBadgeVariant(status)}>
            {status} × {executionStatusCounts[status]}
          </Badge>
        </Link>
      ))}
      <Link
        href={buildAgentsOpsHref({
          agentId: selectedAgent.id,
          executionStatus: "all",
          policyKey: policyKeyFilter,
          q: query,
          sourceType: sourceTypeFilter,
        })}
      >
        <Badge variant="glass">show all</Badge>
      </Link>
    </>
  ) : agentExecutionsDependency ? (
    <DependencyState label="智能体执行目录" result={agentExecutionsDependency} />
  ) : null;
  const selectedExternalGovernanceRows: DetailListRow[] =
    selectedAgent.sourceType === "external"
      ? [
          {
            label: "Protocol / Secret",
            value: `v${selectedAgent.externalCallbackProtocolVersion} / secret v${selectedAgent.externalCallbackSecretVersion}`,
          },
          {
            label: "协议窗口",
            value: `${callbackWindowStateLabel(
              selectedAgent.externalCallbackProtocolWindowState,
            )}${selectedAgent.externalCallbackPreviousProtocolVersion ? ` · prev v${selectedAgent.externalCallbackPreviousProtocolVersion}` : ""}${selectedAgent.externalCallbackProtocolGraceUntil ? ` · 截止 ${formatShanghaiDateTime(selectedAgent.externalCallbackProtocolGraceUntil)}` : ""}`,
          },
          {
            label: "Secret 窗口",
            value: `${callbackWindowStateLabel(
              selectedAgent.externalCallbackSecretWindowState,
            )}${selectedAgent.externalCallbackPreviousSecretVersion ? ` · prev v${selectedAgent.externalCallbackPreviousSecretVersion}` : ""}${selectedAgent.externalCallbackSecretGraceUntil ? ` · 截止 ${formatShanghaiDateTime(selectedAgent.externalCallbackSecretGraceUntil)}` : ""}`,
          },
          {
            label: "策略",
            value: (
              <>
                {selectedAgent.externalCallbackRemediationPolicy
                  ? formatAgentCallbackPolicyLabel(
                      selectedAgent.externalCallbackRemediationPolicy,
                    )
                  : selectedAgent.externalCallbackRemediationPolicyKey}
                {selectedAgent.externalCallbackRemediationPolicy ? (
                  <>
                    <br />
                    Replay 兼容：
                    {formatAgentCallbackReplayCompatibilityPolicy(
                      selectedAgent.externalCallbackRemediationPolicy,
                    )}
                    <br />
                    Fallback 画像：
                    {formatAgentCallbackReplayFallbackProfile(
                      selectedAgent.externalCallbackRemediationPolicy,
                    )}
                  </>
                ) : null}
              </>
            ),
          },
        ]
      : [];
  const selectedCallbackHistoryItems: TimelineItem[] =
    selectedCallbackHistory.map((entry) => ({
      key: entry.id,
      label: (
        <>
          {callbackHistoryChangeLabel(entry.changeType)}
          <br />
          <span className="app-note">
            {formatShanghaiDateTime(entry.createdAt)}
          </span>
        </>
      ),
      value: (
        <>
          协议 {entry.previousProtocolVersion ?? "—"} →{" "}
          {entry.nextProtocolVersion ?? "—"}
          <br />
          密钥 {entry.previousSecretVersion ?? "—"} →{" "}
          {entry.nextSecretVersion ?? "—"}
          {entry.graceUntil ? (
            <>
              <br />
              <span className="app-note">
                兼容至 {formatShanghaiDateTime(entry.graceUntil)}
              </span>
            </>
          ) : null}
          {entry.note ? (
            <>
              <br />
              <span className="app-note">{entry.note}</span>
            </>
          ) : null}
        </>
      ),
    }));
  const selectedCallbackHealthRows: DetailListRow[] = selectedHealth
    ? [
        {
          label: "总回调量",
          value: formatCount(selectedHealth.totalCallbacks),
        },
        {
          label: "accepted / duplicate",
          value: `${formatCount(selectedHealth.acceptedCallbacks)} / ${formatCount(selectedHealth.duplicateCallbacks)}`,
        },
        {
          label: "rejected",
          value: formatCount(selectedHealth.rejectedCallbacks),
        },
        {
          label: "duplicate rate",
          value: formatRate(
            selectedHealth.duplicateCallbacks,
            selectedHealth.totalCallbacks,
          ),
        },
        {
          label: "rejected rate",
          value: formatRate(
            selectedHealth.rejectedCallbacks,
            selectedHealth.totalCallbacks,
          ),
        },
        {
          label: "协议命中",
          value: `当前 ${formatCount(selectedHealth.currentProtocolHits)} / 旧版 ${formatCount(selectedHealth.previousProtocolHits)}`,
        },
        {
          label: "密钥命中",
          value: `当前 ${formatCount(selectedHealth.currentSecretHits)} / 旧版 ${formatCount(selectedHealth.previousSecretHits)}`,
        },
        {
          label: "最近回调",
          value: formatShanghaiDateTime(selectedHealth.lastReceivedAt),
        },
        {
          label: "类型分布",
          value:
            selectedHealth.byCallbackType.length > 0
              ? selectedHealth.byCallbackType
                  .map((item) => `${item.key} (${item.count})`)
                  .join(" / ")
              : "暂无",
        },
      ]
    : [];
  const selectedCallbackRecommendationItems: AgentRecommendationItem[] =
    callbackRecommendations.map((recommendation) => ({
      key: `${selectedAgent.id}-${recommendation.title}`,
      title: recommendation.title,
      detail: recommendation.detail,
      badge: (
        <Badge variant={recommendation.variant}>
          {callbackRecommendationToneLabel(recommendation.variant)}
        </Badge>
      ),
      action: (
        <Link className="nt-btn nt-btn--secondary" href={recommendation.href}>
          前往排查
        </Link>
      ),
    }));

  const selectedRecentCallbackAuditItems =
    selectedRecentCallbackAudits.length > 0 ? (
      <div className="app-task-list">
        {selectedRecentCallbackAudits.map((entry) =>
          buildSelectedRecentCallbackAuditItem({
            buildAgentCallbackOpsHref,
            entry,
            formatShanghaiDateTime,
            recentCallbacksReturnHref,
            renderCallbackFollowUpFields,
            selectedAgent: {
              id: selectedAgent.id,
              ownerUserId: selectedAgent.ownerUserId,
            },
          }),
        )}
      </div>
    ) : null;

  return (
    <>
      <SelectedAgentOverviewCard
        detailRows={selectedOverviewDetailRows}
        focusMetrics={selectedOverviewFocusMetrics}
        statusActions={selectedOverviewStatusActions}
      />

      {selectedAgent.sourceType === "external" ? (
        <>
          <SelectedAgentExternalGovernanceCard
            detailRows={selectedExternalGovernanceRows}
          />

          {callbackPolicyRecommendation ? (
            <SelectedAgentPolicyRecommendationCard
              action={
                <form
                  action={updateAgentCallbackRemediationPolicyAction}
                >
                  <input
                    name="agentId"
                    type="hidden"
                    value={selectedAgent.id}
                  />
                  <input
                    name="policyKey"
                    type="hidden"
                    value={
                      callbackPolicyRecommendation.recommendedPolicyKey
                    }
                  />
                  <input
                    name="redirectTo"
                    type="hidden"
                    value={currentOpsHref}
                  />
                      <button
                        className="nt-btn nt-btn--secondary"
                        disabled={remediationPoliciesUnavailable}
                        type="submit"
                      >
                    切到{" "}
                    {remediationPolicies.find(
                      (policy) =>
                        policy.key ===
                        callbackPolicyRecommendation.recommendedPolicyKey,
                    )?.label ||
                      callbackPolicyRecommendation.recommendedPolicyKey}
                  </button>
                </form>
              }
              detail={callbackPolicyRecommendation.detail}
              subtitle="策略建议"
              title={callbackPolicyRecommendation.title}
              toneBadge={
                <Badge variant={callbackPolicyRecommendation.tone}>
                  {callbackRecommendationToneLabel(
                    callbackPolicyRecommendation.tone,
                  )}
                </Badge>
              }
            />
          ) : null}

          {remediationPoliciesUnavailable && remediationPoliciesDependency ? (
            <DependencyState label="回调补救策略" result={remediationPoliciesDependency} />
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "14px",
            }}
          >
            <SelectedAgentControlCard
              detail={
                <p className="app-note">
                  直接从当前智能体切换默认补救策略，
                  作为被拒绝回调自动补救的基础口径。
                </p>
              }
              form={
                <form
                  action={updateAgentCallbackRemediationPolicyAction}
                  className="app-form-grid"
                >
                  <input
                    name="agentId"
                    type="hidden"
                    value={selectedAgent.id}
                  />
                  <input
                    name="redirectTo"
                    type="hidden"
                    value={currentOpsHref}
                  />
                  <Select
                    defaultValue={
                      selectedAgent.externalCallbackRemediationPolicyKey
                    }
                    name="policyKey"
                  >
                    {policyCatalog.map((policy) => (
                      <option key={policy.key} value={policy.key}>
                        {formatAgentCallbackPolicyLabel(policy)}
                      </option>
                    ))}
                  </Select>
                  <button
                    className="nt-btn nt-btn--secondary"
                    disabled={remediationPoliciesUnavailable}
                    type="submit"
                  >
                    应用策略
                  </button>
                </form>
              }
              subtitle="补救策略"
              title="切换回调策略"
            />
            <SelectedAgentControlCard
              detail={
                <p className="app-note">
                  更新 callback protocol 版本，并把协议窗口治理继续留在当前页。
                </p>
              }
              form={
                <form
                  action={updateAgentCallbackProtocolVersionAction}
                  className="app-form-grid"
                >
                  <input
                    name="agentId"
                    type="hidden"
                    value={selectedAgent.id}
                  />
                  <input
                    name="redirectTo"
                    type="hidden"
                    value={currentOpsHref}
                  />
                  <Input
                    className="mg-input"
                    defaultValue={String(
                      selectedAgent.externalCallbackProtocolVersion,
                    )}
                    inputMode="numeric"
                    min="1"
                    name="protocolVersion"
                    required
                    type="number"
                  />
                  <button
                    className="nt-btn nt-btn--secondary"
                    type="submit"
                  >
                    更新协议
                  </button>
                </form>
              }
              subtitle="Protocol Window"
              title="更新协议版本"
            />
            <SelectedAgentControlCard
              detail={
                callbackSecretFlash?.agentId === selectedAgent.id ? (
                  <div className="app-banner app-banner--success">
                    新回调密钥：
                    <code>{callbackSecretFlash.callbackSecret}</code>
                  </div>
                ) : (
                  <p className="app-note">
                    页面只会在轮换后短时展示一次完整新密钥。
                  </p>
                )
              }
              form={
                <form
                  action={rotateAgentCallbackSecretAction}
                  className="app-form-grid"
                >
                  <input
                    name="agentId"
                    type="hidden"
                    value={selectedAgent.id}
                  />
                  <input
                    name="redirectTo"
                    type="hidden"
                    value={currentOpsHref}
                  />
                  <button
                    className="nt-btn nt-btn--secondary"
                    type="submit"
                  >
                    轮换密钥
                  </button>
                </form>
              }
              subtitle="Secret Rotation"
              title="轮换回调密钥"
            />
          </div>

          {callbackHealthUnavailable && callbackHealthDependency ? (
            <DependencyState label="回调健康摘要" result={callbackHealthDependency} />
          ) : (
            <SelectedAgentCallbackHealthCard
              detailRows={selectedCallbackHealthRows}
              emptyState={
                <p className="app-note">
                  该 agent 当前还没有 callback 观测数据。
                </p>
              }
              recommendations={selectedCallbackRecommendationItems}
              windowBadge={
                <Badge variant="cyan">
                  {selectedHealth
                    ? `${selectedHealth.windowHours}h`
                    : "no data"}
                </Badge>
              }
            />
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "14px",
            }}
          >
            {selectedCallbackHistoryUnavailable && selectedCallbackHistoryDependency ? (
              <DependencyState label="回调配置历史" result={selectedCallbackHistoryDependency} />
            ) : (
              <SelectedAgentTimelineCard
                badge={
                  <Badge variant="violet">
                    {formatCount(selectedCallbackHistory.length)}
                  </Badge>
                }
                emptyState={
                  <p className="app-note">暂无 callback 配置历史。</p>
                }
                items={selectedCallbackHistoryItems}
                subtitle="回调历史"
                title="配置时间线"
              />
            )}
            {selectedRecentCallbacksUnavailable && selectedRecentCallbacksDependency ? (
              <DependencyState label="近期回调审计" result={selectedRecentCallbacksDependency} />
            ) : (
              <SelectedAgentRecentCallbacksCard
                badge={
                  <Badge variant="warning">
                    {formatCount(selectedRecentCallbackAudits.length)}
                  </Badge>
                }
                emptyState={
                  <p className="app-note">当前没有最近回调审计。</p>
                }
                items={selectedRecentCallbackAuditItems}
              />
            )}
          </div>
        </>
      ) : (
        <SelectedAgentNoticeCard
          badge={<Badge variant="violet">内部</Badge>}
          detail={
            <p className="app-note">
              当前选中的智能体
              属于平台内控链路，主要通过内部执行状态与成果物推进，不依赖
              外部回调密钥 / 协议
              治理面。你仍然可以在下方继续维护能力，并通过执行流转观察运行状态。
            </p>
          }
          subtitle="平台运行"
          title="平台智能体说明"
        />
      )}
    </>
  );
}
