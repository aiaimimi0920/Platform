import Link from "next/link";

import type {
  AgentExecutionRuntimeCatalogView,
  AgentExecutionRuntimeSessionSummaryView,
} from "@neuro/contracts";
import { NtBadge as Badge } from "@/components/nt-primitives";
import type { AgentView } from "@/lib/core-client";
import {
  buildAgentCallbackOpsHref,
  buildPathWithParams,
  formatCount,
  formatShanghaiDateTime,
  recommendationSeverityLabel,
  recommendationSeverityVariant,
  runtimePressureBadgeVariant,
} from "@/lib/agent-ops-presentation";
import { buildRuntimePressurePlaybook } from "@/lib/agent-ops-playbooks";
import {
  formatAgentExecutionLaunchPresetPressureLevelLabel,
  formatAgentExecutionLaunchPresetSchedulingDecisionClassLabel,
  formatAgentExecutionLaunchPresetRuntimeSessionKindLabel,
  formatAgentExecutionLaunchPresetRuntimeSessionStateLabel,
} from "@/lib/agent-execution-launch-presets";
import {
  formatAgentExecutionRuntimeSessionRecommendationActionKindLabel,
  isSweepAgentExecutionRuntimeSessionRecommendationActionKind,
} from "@/lib/agent-execution-runtime-session-playbook";
import {
  recoverStalePlatformExecutionsAction,
  recoverThenRunPlatformExecutorAction,
  runPlatformExecutorNowAction,
  sweepRuntimeSessionsAction,
} from "@/lib/platform-actions";
import {
  renderCallbackFollowUpFields,
  renderRuntimeSessionActionFields,
} from "./agent-ops-form-fields";
import {
  SelectedAgentRuntimeBridgeCard,
  SelectedAgentRuntimePressurePlaybookCard,
  type DetailListRow,
} from "./sections";

type OwnerPressureEntry = AgentExecutionRuntimeCatalogView["utilization"][number];

export function SelectedAgentRuntimeSection(props: {
  operatorActionsUnavailable: boolean;
  ownerPressureEntryCount: number;
  runtimeCatalogUnavailable: boolean;
  runtimePressurePlaybookReturnHref: string;
  selectedAgent: AgentView;
  selectedFailedExecutionCount: number;
  selectedPrimaryOwnerPressure: OwnerPressureEntry | null;
  selectedQueuedExecutionCount: number;
  selectedRunningExecutionCount: number;
  selectedRuntimeSessionSummary: AgentExecutionRuntimeSessionSummaryView | null;
  selectedRuntimeSessionUnavailable: boolean;
}) {
  const {
    operatorActionsUnavailable,
    ownerPressureEntryCount,
    runtimeCatalogUnavailable,
    runtimePressurePlaybookReturnHref,
    selectedAgent,
    selectedFailedExecutionCount,
    selectedPrimaryOwnerPressure,
    selectedQueuedExecutionCount,
    selectedRunningExecutionCount,
    selectedRuntimeSessionSummary,
    selectedRuntimeSessionUnavailable,
  } = props;

  const selectedRuntimeSessionsHref = buildPathWithParams(
    "/ops/agent-callbacks",
    {
      agentId: selectedAgent.id,
      ownerUserId: selectedAgent.ownerUserId,
    },
    "runtime-session-watch",
  );
  const selectedRuntimePressureHref = buildPathWithParams(
    "/ops/agent-callbacks",
    {
      agentId: selectedAgent.id,
      ownerUserId: selectedAgent.ownerUserId,
      runtimePressureLevel: selectedPrimaryOwnerPressure?.pressureLevel,
      runtimeSchedulingDecisionClass:
        selectedPrimaryOwnerPressure?.schedulingDecisionClass,
    },
    "runtime-pressure",
  );
  const selectedRuntimeRecommendation =
    selectedRuntimeSessionSummary?.recommendations[0] ?? null;
  const selectedRuntimeRecommendationHref = selectedRuntimeRecommendation
    ? buildPathWithParams(
        "/ops/agent-callbacks",
        {
          agentId: selectedAgent.id,
          ownerUserId: selectedAgent.ownerUserId,
          runtimeState: selectedRuntimeRecommendation.runtimeState,
          runtimeKind: selectedRuntimeRecommendation.runtimeKind,
          runtimeStaleOnly:
            selectedRuntimeRecommendation.staleOnly === null
              ? null
              : selectedRuntimeRecommendation.staleOnly
                ? "true"
                : "false",
        },
        "runtime-session-watch",
      )
    : selectedRuntimeSessionsHref;
  const selectedRuntimePlaybook = buildRuntimePressurePlaybook({
    agent: selectedAgent,
    pressure: selectedPrimaryOwnerPressure,
    runtimeSummary: selectedRuntimeSessionSummary,
    queuedCount: selectedQueuedExecutionCount,
    runningCount: selectedRunningExecutionCount,
    failedCount: selectedFailedExecutionCount,
  });
  const selectedRuntimePlaybookSignalRows: DetailListRow[] =
    selectedRuntimePlaybook && selectedRuntimeSessionSummary
      ? [
          {
            label: "压力配置",
            value: selectedPrimaryOwnerPressure
              ? `${selectedPrimaryOwnerPressure.key} / ${selectedPrimaryOwnerPressure.pressureDetail}`
              : "当前目录没有主归属热点",
          },
          {
            label: "归属热点",
            value: selectedPrimaryOwnerPressure?.busiestOwnerUserId
              ? `${selectedPrimaryOwnerPressure.busiestOwnerUserId} / 运行 ${selectedPrimaryOwnerPressure.busiestOwnerRunningCount ?? 0} / 阻塞 ${selectedPrimaryOwnerPressure.busiestBlockedOwnerQueuedCount ?? 0}`
              : "当前没有归属热点",
          },
          {
            label: "调度面",
            value: `${formatAgentExecutionLaunchPresetSchedulingDecisionClassLabel(
              selectedPrimaryOwnerPressure?.schedulingDecisionClass ??
                "within_capacity",
            )} / 饱和归属 ${formatCount(selectedPrimaryOwnerPressure?.saturatedOwnerCount ?? 0)}`,
          },
          {
            label: "执行面",
            value: `运行 ${formatCount(selectedRunningExecutionCount)} / 排队 ${formatCount(selectedQueuedExecutionCount)} / 失败 ${formatCount(selectedFailedExecutionCount)}`,
          },
          {
            label: "运行会话",
            value: `打开 ${formatCount(selectedRuntimeSessionSummary.openCount)} / 过期 ${formatCount(selectedRuntimeSessionSummary.staleOpenCount)} / 终态 ${formatCount(selectedRuntimeSessionSummary.terminalExecutionOpenCount)}`,
          },
        ]
      : [];
  const selectedExecutionWatchHref = buildAgentCallbackOpsHref(
    selectedAgent.id,
    {
      executionStatus:
        selectedQueuedExecutionCount > 0
          ? "queued"
          : selectedRunningExecutionCount > 0
            ? "running"
            : selectedFailedExecutionCount > 0
              ? "failed"
              : null,
      recentWindow: "24h",
    },
    "execution-run-watch",
  );
  const selectedRuntimePlaybookBadges =
    selectedRuntimePlaybook && selectedRuntimeSessionSummary ? (
      <div className="app-inline-actions">
        <Badge
          variant={selectedRuntimePlaybook.tone}
        >
          {selectedPrimaryOwnerPressure
            ? formatAgentExecutionLaunchPresetPressureLevelLabel(
                selectedPrimaryOwnerPressure.pressureLevel,
              )
            : "健康"}
        </Badge>
        <Badge
          variant={
            selectedPrimaryOwnerPressure ? "warning" : "cyan"
          }
        >
          {formatAgentExecutionLaunchPresetSchedulingDecisionClassLabel(
            selectedPrimaryOwnerPressure?.schedulingDecisionClass ??
              "within_capacity",
          )}
        </Badge>
        {selectedPrimaryOwnerPressure?.key ? (
          <Badge variant="violet">
            配置 {selectedPrimaryOwnerPressure.key}
          </Badge>
        ) : null}
        {selectedRuntimeSessionSummary.staleOpenCount > 0 ? (
          <Badge variant="warning">
            过期 {formatCount(selectedRuntimeSessionSummary.staleOpenCount)}
          </Badge>
        ) : null}
        {selectedRuntimeSessionSummary.terminalExecutionOpenCount > 0 ? (
          <Badge variant="danger">
            terminal{" "}
            {formatCount(
              selectedRuntimeSessionSummary.terminalExecutionOpenCount,
            )}
          </Badge>
        ) : null}
      </div>
    ) : null;
  const selectedRuntimePlaybookPrimaryActions =
    !operatorActionsUnavailable && selectedRuntimePlaybook ? (
      selectedRuntimePlaybook.shouldRecoverThenRun ? (
        <form
          action={recoverThenRunPlatformExecutorAction}
          className="app-inline-actions"
        >
          <input
            type="hidden"
            name="redirectTo"
            value={runtimePressurePlaybookReturnHref}
          />
          <input
            type="hidden"
            name="recoveryLimit"
            value={String(selectedRuntimePlaybook.recoveryLimit)}
          />
          <input
            type="hidden"
            name="executorLimit"
            value={String(selectedRuntimePlaybook.executorLimit)}
          />
          <input
            type="hidden"
            name="staleSeconds"
            value={String(selectedRuntimePlaybook.staleSeconds)}
          />
          {renderRuntimeSessionActionFields({
            agentId: selectedAgent.id,
            ownerUserId: selectedAgent.ownerUserId,
            runtimeState: null,
            runtimeKind: null,
            runtimeStaleOnly: "true",
          })}
          <button className="nt-btn nt-btn--primary" type="submit">
            Recover + Run owner slice
          </button>
        </form>
      ) : selectedRuntimePlaybook.shouldRecoverStale ? (
        <form
          action={recoverStalePlatformExecutionsAction}
          className="app-inline-actions"
        >
          <input
            type="hidden"
            name="redirectTo"
            value={runtimePressurePlaybookReturnHref}
          />
          <input
            type="hidden"
            name="limit"
            value={String(selectedRuntimePlaybook.recoveryLimit)}
          />
          <input
            type="hidden"
            name="staleSeconds"
            value={String(selectedRuntimePlaybook.staleSeconds)}
          />
          {renderRuntimeSessionActionFields({
            agentId: selectedAgent.id,
            ownerUserId: selectedAgent.ownerUserId,
            runtimeState: "requeued",
            runtimeKind: "stale_recovery",
            runtimeStaleOnly: "true",
          })}
          <button className="nt-btn nt-btn--primary" type="submit">
            Recover stale executions
          </button>
        </form>
      ) : selectedRuntimePlaybook.shouldRunExecutor ? (
        <form
          action={runPlatformExecutorNowAction}
          className="app-inline-actions"
        >
          <input
            type="hidden"
            name="redirectTo"
            value={runtimePressurePlaybookReturnHref}
          />
          <input
            type="hidden"
            name="limit"
            value={String(selectedRuntimePlaybook.executorLimit)}
          />
          {renderRuntimeSessionActionFields({
            agentId: selectedAgent.id,
            ownerUserId: selectedAgent.ownerUserId,
            runtimeState: "running",
            runtimeKind: "platform_executor",
          })}
          <button className="nt-btn nt-btn--primary" type="submit">
            Run platform executor
          </button>
        </form>
      ) : selectedRuntimePlaybook.shouldSweepSessions ? (
        <form
          action={sweepRuntimeSessionsAction}
          className="app-inline-actions"
        >
          <input
            type="hidden"
            name="redirectTo"
            value={runtimePressurePlaybookReturnHref}
          />
          <input
            type="hidden"
            name="limit"
            value={String(selectedRuntimePlaybook.sweepLimit)}
          />
          <input
            type="hidden"
            name="staleSeconds"
            value={String(selectedRuntimePlaybook.staleSeconds)}
          />
          {renderRuntimeSessionActionFields({
            agentId: selectedAgent.id,
            ownerUserId: selectedAgent.ownerUserId,
            runtimeState: null,
            runtimeKind: null,
            runtimeStaleOnly: "true",
          })}
          <button className="nt-btn nt-btn--primary" type="submit">
            清理过期 / 终态
          </button>
        </form>
      ) : (
        <Link className="nt-btn nt-btn--primary" href={selectedRuntimePressureHref}>
          打开运行压力
        </Link>
      )
    ) : null;
  const selectedRuntimePlaybookSecondaryActions =
    !operatorActionsUnavailable && selectedRuntimePlaybook ? (
      <div className="app-inline-actions" style={{ flexWrap: "wrap" }}>
        <Link className="nt-btn nt-btn--secondary" href={selectedRuntimePressureHref}>
          运行压力
        </Link>
        <Link className="nt-btn nt-btn--ghost" href={selectedRuntimeSessionsHref}>
          运行会话
        </Link>
        <Link className="nt-btn nt-btn--ghost" href={selectedExecutionWatchHref}>
          执行观测
        </Link>
        {selectedRuntimePlaybook.shouldSweepSessions &&
        (selectedRuntimePlaybook.shouldRecoverThenRun ||
          selectedRuntimePlaybook.shouldRecoverStale ||
          selectedRuntimePlaybook.shouldRunExecutor) ? (
          <form
            action={sweepRuntimeSessionsAction}
            className="app-inline-actions"
          >
            <input
              type="hidden"
              name="redirectTo"
              value={runtimePressurePlaybookReturnHref}
            />
            <input
              type="hidden"
              name="limit"
              value={String(selectedRuntimePlaybook.sweepLimit)}
            />
            <input
              type="hidden"
              name="staleSeconds"
              value={String(selectedRuntimePlaybook.staleSeconds)}
            />
            {renderRuntimeSessionActionFields({
              agentId: selectedAgent.id,
              ownerUserId: selectedAgent.ownerUserId,
              runtimeState: null,
              runtimeKind: null,
              runtimeStaleOnly: "true",
            })}
            <button className="nt-btn nt-btn--ghost" type="submit">
              Sweep residue
            </button>
          </form>
        ) : null}
        {selectedRuntimePlaybook.shouldRunExecutor &&
        (selectedRuntimePlaybook.shouldRecoverThenRun ||
          selectedRuntimePlaybook.shouldRecoverStale) ? (
          <form
            action={runPlatformExecutorNowAction}
            className="app-inline-actions"
          >
            <input
              type="hidden"
              name="redirectTo"
              value={runtimePressurePlaybookReturnHref}
            />
            <input
              type="hidden"
              name="limit"
              value={String(selectedRuntimePlaybook.executorLimit)}
            />
            {renderRuntimeSessionActionFields({
              agentId: selectedAgent.id,
              ownerUserId: selectedAgent.ownerUserId,
              runtimeState: "running",
              runtimeKind: "platform_executor",
            })}
            <button className="nt-btn nt-btn--ghost" type="submit">
              Run executor tick
            </button>
          </form>
        ) : null}
      </div>
    ) : null;

  return (
    <>
      {!runtimeCatalogUnavailable && !selectedRuntimeSessionUnavailable && selectedRuntimeSessionSummary ? (
        <SelectedAgentRuntimeBridgeCard
          id="runtime-bridge"
          oldestOpenLabel={formatShanghaiDateTime(
            selectedRuntimeSessionSummary.oldestOpenStartedAt,
          )}
          oldestStaleLabel={formatShanghaiDateTime(
            selectedRuntimeSessionSummary.oldestStaleStartedAt,
          )}
          openCount={formatCount(
            selectedRuntimeSessionSummary.openCount,
          )}
          pressureDetail={
            selectedPrimaryOwnerPressure
              ? `${selectedPrimaryOwnerPressure.pressureDetail} / 配置 ${selectedPrimaryOwnerPressure.key} / 运行 ${selectedPrimaryOwnerPressure.runningExecutionCount} / 排队 ${selectedPrimaryOwnerPressure.queuedExecutionCount}`
              : selectedRuntimeSessionSummary.openCount > 0
                ? "当前智能体已经有运行会话，但运行目录里还没有归属热点信号。先看打开 / 过期会话。"
                : "当前没有明显运行热点；保持常规巡检即可。"
          }
          pressureHref={selectedRuntimePressureHref}
          pressureLabel={
            selectedPrimaryOwnerPressure
              ? formatAgentExecutionLaunchPresetPressureLevelLabel(
                  selectedPrimaryOwnerPressure.pressureLevel,
                )
              : "压力健康"
          }
          profileCount={formatCount(ownerPressureEntryCount)}
          recommendationDetail={
            selectedRuntimeRecommendation?.detail ?? null
          }
          recommendationMeta={
            selectedRuntimeRecommendation ? (
              <div className="app-inline-actions">
                <Badge
                  variant={recommendationSeverityVariant(
                    selectedRuntimeRecommendation.severity,
                  )}
                >
                  {recommendationSeverityLabel(selectedRuntimeRecommendation.severity)}
                </Badge>
                <Badge
                  variant={
                    isSweepAgentExecutionRuntimeSessionRecommendationActionKind(
                      selectedRuntimeRecommendation.actionKind,
                    )
                      ? "warning"
                      : "cyan"
                  }
                >
                  {formatAgentExecutionRuntimeSessionRecommendationActionKindLabel(
                    selectedRuntimeRecommendation.actionKind,
                  )}
                </Badge>
                {selectedRuntimeRecommendation.runtimeKind ? (
                  <Badge variant="violet">
                    {formatAgentExecutionLaunchPresetRuntimeSessionKindLabel(
                      selectedRuntimeRecommendation.runtimeKind,
                    )}
                  </Badge>
                ) : null}
                {selectedRuntimeRecommendation.runtimeState ? (
                  <Badge variant="cyan">
                    {formatAgentExecutionLaunchPresetRuntimeSessionStateLabel(
                      selectedRuntimeRecommendation.runtimeState,
                    )}
                  </Badge>
                ) : null}
                {selectedRuntimeRecommendation.staleOnly ? (
                  <Badge variant="warning">stale</Badge>
                ) : null}
              </div>
            ) : null
          }
          recommendationActions={
            selectedRuntimeRecommendation ? (
              isSweepAgentExecutionRuntimeSessionRecommendationActionKind(
                selectedRuntimeRecommendation.actionKind,
              ) ? (
                <form
                  action={sweepRuntimeSessionsAction}
                  className="app-inline-actions"
                >
                  <input
                    type="hidden"
                    name="redirectTo"
                    value={selectedRuntimeRecommendationHref}
                  />
                  <input
                    type="hidden"
                    name="limit"
                    value={String(
                      selectedRuntimeRecommendation.suggestedLimit ??
                        25,
                    )}
                  />
                  <input
                    type="hidden"
                    name="staleSeconds"
                    value={String(
                      selectedRuntimeRecommendation.suggestedStaleSeconds ??
                        60,
                    )}
                  />
                  {renderRuntimeSessionActionFields({
                    agentId: selectedAgent.id,
                    ownerUserId: selectedAgent.ownerUserId,
                    runtimeState:
                      selectedRuntimeRecommendation.runtimeState,
                    runtimeKind:
                      selectedRuntimeRecommendation.runtimeKind,
                    runtimeStaleOnly:
                      selectedRuntimeRecommendation.staleOnly === null
                        ? null
                        : selectedRuntimeRecommendation.staleOnly
                          ? "true"
                          : "false",
                  })}
                  {renderCallbackFollowUpFields({
                    agentId: selectedAgent.id,
                    ownerUserId: selectedAgent.ownerUserId,
                    runtimeState:
                      selectedRuntimeRecommendation.runtimeState,
                    runtimeKind:
                      selectedRuntimeRecommendation.runtimeKind,
                    runtimeStaleOnly:
                      selectedRuntimeRecommendation.staleOnly === null
                        ? null
                        : selectedRuntimeRecommendation.staleOnly
                          ? "true"
                          : "false",
                    recentWindow: "15m",
                    fragment: "runtime-session-watch",
                  })}
                      <button
                        className="nt-btn nt-btn--secondary"
                        disabled={operatorActionsUnavailable}
                        type="submit"
                      >
                    {selectedRuntimeRecommendation.actionLabel}
                  </button>
                </form>
              ) : (
                <Link
                  className="nt-btn nt-btn--secondary"
                  href={selectedRuntimeRecommendationHref}
                >
                  {selectedRuntimeRecommendation.actionLabel}
                </Link>
              )
            ) : null
          }
          recommendationTitle={
            selectedRuntimeRecommendation?.title ?? null
          }
          schedulingLabel={
            selectedPrimaryOwnerPressure
              ? formatAgentExecutionLaunchPresetSchedulingDecisionClassLabel(
                  selectedPrimaryOwnerPressure.schedulingDecisionClass,
                )
              : "Scheduling Within Capacity"
          }
          sessionsHref={selectedRuntimeSessionsHref}
          staleOpenCount={formatCount(
            selectedRuntimeSessionSummary.staleOpenCount,
          )}
          terminalOpenCount={formatCount(
            selectedRuntimeSessionSummary.terminalExecutionOpenCount,
          )}
          tone={runtimePressureBadgeVariant(
            selectedPrimaryOwnerPressure?.pressureLevel,
          )}
        />
      ) : null}

      {selectedRuntimePlaybook ? (
        <SelectedAgentRuntimePressurePlaybookCard
          badges={selectedRuntimePlaybookBadges}
          detail={selectedRuntimePlaybook.detail}
          id="runtime-pressure-playbook"
          postureLabel={selectedRuntimePlaybook.postureLabel}
          primaryActions={selectedRuntimePlaybookPrimaryActions}
          secondaryActions={selectedRuntimePlaybookSecondaryActions}
          signalRows={selectedRuntimePlaybookSignalRows}
          title={selectedRuntimePlaybook.title}
          tone={selectedRuntimePlaybook.tone}
        />
      ) : null}
    </>
  );
}
