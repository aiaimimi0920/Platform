import type {
  AgentCallbackHealthSummaryView,
  AgentExecutionRuntimeCatalogView,
  AgentExecutionRuntimeSessionSummaryView,
} from "@neuro/contracts";
import type { AgentView } from "./core-client";
import {
  buildAgentCallbackOpsHref,
  buildAgentsOpsHref,
  runtimePressureBadgeVariant,
} from "./agent-ops-presentation";

export type CallbackHealthRecommendation = {
  title: string;
  detail: string;
  href: string;
  variant: "danger" | "warning" | "cyan";
};

export type HealthPosture = {
  detail: string;
  label: string;
  variant: "danger" | "warning" | "cyan" | "violet";
};

export type OperatorPlaybookAction = {
  href: string;
  label: string;
  variant: "primary" | "secondary" | "ghost";
};

export type OperatorPlaybook = {
  detail: string;
  actions: OperatorPlaybookAction[];
  title: string;
};

export type RuntimePressurePlaybook = {
  detail: string;
  executorLimit: number;
  postureLabel: string;
  recoveryLimit: number;
  shouldRecoverStale: boolean;
  shouldRecoverThenRun: boolean;
  shouldRunExecutor: boolean;
  shouldSweepSessions: boolean;
  staleSeconds: number;
  sweepLimit: number;
  title: string;
  tone: "danger" | "warning" | "cyan" | "violet" | "success";
};

export function callbackRecommendationToneLabel(
  variant: CallbackHealthRecommendation["variant"],
) {
  switch (variant) {
    case "danger":
      return "attention";
    case "warning":
      return "watch";
    case "cyan":
    default:
      return "normal";
  }
}

export function buildCallbackHealthRecommendations(
  agentId: string,
  summary: AgentCallbackHealthSummaryView | null,
): CallbackHealthRecommendation[] {
  if (!summary || summary.totalCallbacks === 0) {
    return [];
  }

  const recommendations: CallbackHealthRecommendation[] = [];
  const duplicateRate =
    summary.totalCallbacks > 0
      ? summary.duplicateCallbacks / summary.totalCallbacks
      : 0;

  if (summary.previousProtocolHits > 0) {
    recommendations.push({
      title: "旧协议仍在命中",
      detail: `最近窗口内有 ${summary.previousProtocolHits} 次 callback 仍使用旧协议，建议检查兼容窗口是否该收口。`,
      href: buildAgentCallbackOpsHref(agentId, {
        protocolMatch: "previous",
        recentWindow: "24h",
      }),
      variant: summary.previousProtocolHits >= 3 ? "danger" : "warning",
    });
  }

  if (summary.previousSecretHits > 0) {
    recommendations.push({
      title: "旧密钥仍在命中",
      detail: `最近窗口内有 ${summary.previousSecretHits} 次 callback 仍使用旧密钥，建议核对 third-party 执行端是否已经切换。`,
      href: buildAgentCallbackOpsHref(agentId, {
        secretMatch: "previous",
        recentWindow: "24h",
      }),
      variant: summary.previousSecretHits >= 3 ? "danger" : "warning",
    });
  }

  if (summary.duplicateCallbacks > 0) {
    recommendations.push({
      title: "重复回调偏高",
      detail: `最近窗口内重复回调为 ${summary.duplicateCallbacks} 次，占比约 ${Math.round(duplicateRate * 100)}%。建议回看幂等与重放行为。`,
      href: buildAgentCallbackOpsHref(agentId, {
        status: "duplicate",
        recentWindow: "24h",
      }),
      variant:
        duplicateRate >= 0.3 || summary.duplicateCallbacks >= 5
          ? "danger"
          : "warning",
    });
  }

  if (summary.rejectedCallbacks > 0) {
    recommendations.push({
      title: "被拒绝回调已出现",
      detail: `最近窗口内有 ${summary.rejectedCallbacks} 次回调被平台拒绝，建议检查签名、时间戳或协议版本。`,
      href: buildAgentCallbackOpsHref(agentId, {
        status: "rejected",
        recentWindow: "24h",
      }),
      variant: summary.rejectedCallbacks >= 3 ? "danger" : "warning",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "回调健康正常",
      detail:
        "最近窗口内没有旧协议、旧密钥或显著重复异常，可以继续观察已接收回调趋势。",
      href: buildAgentCallbackOpsHref(agentId, { recentWindow: "24h" }),
      variant: "cyan",
    });
  }

  return recommendations;
}

export function buildHealthPosture(
  agent: Pick<AgentView, "sourceType">,
  summary: AgentCallbackHealthSummaryView | null,
): HealthPosture {
  if (agent.sourceType !== "external") {
    return {
      label: "平台内控",
      detail: "平台智能体主要走内部执行链，不依赖外部回调补救面。",
      variant: "violet",
    };
  }

  if (!summary || summary.totalCallbacks === 0) {
    return {
      label: "待观测",
      detail:
        "还没有进入回调观测窗口，先完成一次真实执行再判断治理姿态。",
      variant: "cyan",
    };
  }

  const compatibilityHits =
    summary.previousProtocolHits + summary.previousSecretHits;
  if (summary.rejectedCallbacks >= 3 || compatibilityHits >= 3) {
    return {
      label: "高风险",
      detail:
        "已经出现明显被拒绝回调或旧版本命中，建议优先处理回调兼容窗口。",
      variant: "danger",
    };
  }
  if (
    summary.rejectedCallbacks > 0 ||
    compatibilityHits > 0 ||
    summary.duplicateCallbacks > 0
  ) {
    return {
      label: "观察中",
      detail:
        "当前已有重复回调 / 兼容命中，建议保留回调运维关注。",
      variant: "warning",
    };
  }
  return {
    label: "健康",
    detail: "最近窗口内没有明显回调风险，可以按日常频率巡检。",
    variant: "cyan",
  };
}

export function buildOperatorPlaybook(args: {
  agent: Pick<AgentView, "id" | "sourceType">;
  currentOpsHref: string;
  executionCount: number;
  health: AgentCallbackHealthSummaryView | null;
}) {
  const { agent, currentOpsHref, executionCount, health } = args;

  if (agent.sourceType !== "external") {
    return {
      title: "平台智能体维护建议",
      detail:
        "优先补全能力描述，再通过执行流转观察运行状态与产出，不需要把精力放在外部回调治理。",
      actions: [
        {
          href: buildAgentsOpsHref({
            agentId: agent.id,
            executionStatus: "all",
          }),
          label: "查看当前执行切片",
          variant: "secondary",
        },
        {
          href: buildAgentsOpsHref({
            agentId: agent.id,
            executionStatus: "running",
          }),
          label: "只看运行中",
          variant: "ghost",
        },
      ],
    } satisfies OperatorPlaybook;
  }

  if (!health || health.totalCallbacks === 0) {
    return {
      title: "先打出首条回调",
      detail:
        "当前还没有回调观测数据。建议先触发一次真实外部执行，再根据已接收 / 被拒绝情况调整策略。",
      actions: [
        { href: "/agents?mode=tasks", label: "打开智能体中心", variant: "primary" },
        {
          href: currentOpsHref,
          label: "留在当前页补能力",
          variant: "ghost",
        },
      ],
    } satisfies OperatorPlaybook;
  }

  const compatibilityHits =
    health.previousProtocolHits + health.previousSecretHits;
  if (health.rejectedCallbacks >= 3 || compatibilityHits >= 3) {
    return {
      title: "优先处理兼容窗口",
      detail:
        "当前被拒绝回调或旧版本命中已经偏高，应该先去回调审计和兼容窗口排查，再继续放量执行。",
      actions: [
        {
          href: buildAgentCallbackOpsHref(agent.id, {
            status: "rejected",
            recentWindow: "24h",
          }),
          label: "打开被拒绝审计",
          variant: "primary",
        },
        {
          href: buildAgentCallbackOpsHref(agent.id, {
            protocolMatch: "previous",
            recentWindow: "24h",
          }),
          label: "查看旧协议命中",
          variant: "secondary",
        },
      ],
    } satisfies OperatorPlaybook;
  }

  if (health.duplicateCallbacks > 0) {
    return {
      title: "复核重复与重放策略",
      detail:
        "当前重复回调已经出现，但兼容窗口压力不高。优先检查重放 / 幂等行为，再决定是否收紧策略。",
      actions: [
        {
          href: buildAgentCallbackOpsHref(agent.id, {
            status: "duplicate",
            recentWindow: "24h",
          }),
          label: "查看重复审计",
          variant: "primary",
        },
        {
          href: currentOpsHref,
          label: "留在当前页调整策略",
          variant: "secondary",
        },
      ],
    } satisfies OperatorPlaybook;
  }

  return {
    title: executionCount > 0 ? "维持日常巡检" : "补第一条执行记录",
      detail:
        executionCount > 0
        ? "当前回调健康度正常，可以维持例行巡检，重点观察运行中的执行是否稳定推进。"
        : "回调健康度正常，但当前还没有执行记录，建议补一条真实执行链路形成观测闭环。",
    actions: [
      {
        href:
          executionCount > 0
            ? buildAgentsOpsHref({
                agentId: agent.id,
                executionStatus: "running",
              })
            : "/agents?mode=tasks",
        label: executionCount > 0 ? "只看运行中执行" : "回智能体中心",
        variant: "primary",
      },
      {
        href: buildAgentCallbackOpsHref(agent.id, { recentWindow: "24h" }),
        label: "打开回调审计",
        variant: "ghost",
      },
    ],
  } satisfies OperatorPlaybook;
}

export function buildRuntimePressurePlaybook(args: {
  agent: Pick<AgentView, "sourceType">;
  pressure: AgentExecutionRuntimeCatalogView["utilization"][number] | null;
  runtimeSummary: AgentExecutionRuntimeSessionSummaryView | null;
  queuedCount: number;
  runningCount: number;
  failedCount: number;
}): RuntimePressurePlaybook | null {
  const {
    agent,
    pressure,
    runtimeSummary,
    queuedCount,
    runningCount,
    failedCount,
  } = args;
  if (!runtimeSummary) {
    return null;
  }

  const staleCount = runtimeSummary.staleOpenCount;
  const terminalCount = runtimeSummary.terminalExecutionOpenCount;
  const openCount = runtimeSummary.openCount;
  const pressureLevel = pressure?.pressureLevel ?? "healthy";
  const tone = runtimePressureBadgeVariant(pressureLevel);
  const recoveryLimit = Math.max(3, Math.min(Math.max(staleCount, failedCount, 3), 25));
  const executorLimit = Math.max(
    3,
    Math.min(Math.max(queuedCount, pressureLevel === "critical" ? 5 : 3), 12),
  );
  const staleSeconds = pressureLevel === "critical" ? 600 : 900;
  const sweepLimit = Math.max(5, Math.min(Math.max(staleCount + terminalCount, 5), 50));

  if (agent.sourceType === "platform") {
    if (pressureLevel === "critical" && (staleCount > 0 || queuedCount > 0 || failedCount > 0)) {
      return {
        title: "优先稳定该归属切片",
        detail:
          `${pressure?.pressureDetail ?? "归属运行压力已经达到严重等级。"} ` +
          "优先恢复过期执行，再运行一轮执行器，让排队或阻塞的工作可以从同一智能体视图继续推进。",
        postureLabel: "恢复 + 推进",
        tone,
        recoveryLimit,
        executorLimit,
        staleSeconds,
        sweepLimit,
        shouldRecoverThenRun: true,
        shouldRecoverStale: staleCount > 0,
        shouldRunExecutor: queuedCount > 0,
        shouldSweepSessions: terminalCount > 0 || staleCount > 1,
      };
    }

    if (staleCount > 0) {
      return {
        title: "优先恢复过期执行",
        detail:
          `该智能体仍有 ${staleCount} 个过期打开运行会话。先把阻塞执行拉回，再决定是否需要再运行一轮执行器。`,
        postureLabel: "恢复过期",
        tone: tone === "cyan" ? "warning" : tone,
        recoveryLimit,
        executorLimit,
        staleSeconds,
        sweepLimit,
        shouldRecoverThenRun: false,
        shouldRecoverStale: true,
        shouldRunExecutor: queuedCount > 0,
        shouldSweepSessions: terminalCount > 0 || staleCount > 1,
      };
    }

    if (queuedCount > 0) {
      return {
        title: "推进排队积压",
        detail:
          `有 ${queuedCount} 条排队执行正在这里等待。从本页运行一轮本地执行器，比切回全局运维台更快。`,
        postureLabel: "推进队列",
        tone: tone === "cyan" ? "warning" : tone,
        recoveryLimit,
        executorLimit,
        staleSeconds,
        sweepLimit,
        shouldRecoverThenRun: false,
        shouldRecoverStale: false,
        shouldRunExecutor: true,
        shouldSweepSessions: terminalCount > 0,
      };
    }

    if (pressureLevel !== "healthy" || runningCount > 0 || openCount > 0) {
      return {
        title: "保持运行压力可见",
        detail:
          pressure?.pressureDetail ??
          "该智能体仍有打开的运行会话，但当前没有直接恢复或推进的积压。继续停留在运行压力与执行观测。",
        postureLabel: "观测",
        tone,
        recoveryLimit,
        executorLimit,
        staleSeconds,
        sweepLimit,
        shouldRecoverThenRun: false,
        shouldRecoverStale: false,
        shouldRunExecutor: false,
        shouldSweepSessions: terminalCount > 0,
      };
    }

    return {
      title: "运行状态平稳",
      detail: "该归属切片当前没有明显压力或过期会话信号。保持常规巡检即可。",
      postureLabel: "平稳",
      tone: "cyan",
      recoveryLimit,
      executorLimit,
      staleSeconds,
      sweepLimit,
      shouldRecoverThenRun: false,
      shouldRecoverStale: false,
      shouldRunExecutor: false,
      shouldSweepSessions: false,
    };
  }

  if (staleCount > 0 || terminalCount > 0) {
    return {
      title: "清理外部运行残留",
      detail:
        `该外部智能体仍有 ${staleCount} 个过期会话和 ${terminalCount} 个终态未关闭运行会话。先清理残留，再回到回调与执行审计。`,
      postureLabel: "清理",
      tone: staleCount >= 3 ? "danger" : "warning",
      recoveryLimit,
      executorLimit,
      staleSeconds,
      sweepLimit,
      shouldRecoverThenRun: false,
      shouldRecoverStale: false,
      shouldRunExecutor: false,
      shouldSweepSessions: true,
    };
  }

  if (pressureLevel !== "healthy") {
    return {
      title: "检查归属热点",
      detail:
        pressure?.pressureDetail ??
        "该归属已经进入运行压力状态，但当前没有需要立即执行的过期恢复步骤。先打开运行压力与执行观测。",
      postureLabel: "检查",
      tone,
      recoveryLimit,
      executorLimit,
      staleSeconds,
      sweepLimit,
      shouldRecoverThenRun: false,
      shouldRecoverStale: false,
      shouldRunExecutor: false,
      shouldSweepSessions: false,
    };
  }

  if (runningCount > 0 || openCount > 0) {
    return {
      title: "保持运行中执行可见",
      detail: "运行面仍有打开的会话，但还没有明显压力或过期信号。继续按常规节奏巡检执行与回调。",
      postureLabel: "观测",
      tone: "cyan",
      recoveryLimit,
      executorLimit,
      staleSeconds,
      sweepLimit,
      shouldRecoverThenRun: false,
      shouldRecoverStale: false,
      shouldRunExecutor: false,
      shouldSweepSessions: false,
    };
  }

  return {
    title: "运行信号平稳",
    detail: "该外部运行面当前没有明显热点。继续常规回调和执行复核。",
    postureLabel: "平稳",
    tone: "cyan",
    recoveryLimit,
    executorLimit,
    staleSeconds,
    sweepLimit,
    shouldRecoverThenRun: false,
    shouldRecoverStale: false,
    shouldRunExecutor: false,
    shouldSweepSessions: false,
  };
}
