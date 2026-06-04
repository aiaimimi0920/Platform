import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("notification webhook payload", () => {
  async function loadWebhookModule() {
    process.env.DATABASE_URL ??= "postgres://example:example@localhost:5432/neuroloom";
    process.env.REDIS_URL ??= "redis://localhost:6379";
    process.env.WEB_PUBLIC_BASE_URL = "https://app.example.com";
    return import("./notification-webhook");
  }

  async function loadWebhookStateModule() {
    process.env.DATABASE_URL ??= "postgres://example:example@localhost:5432/neuroloom";
    process.env.REDIS_URL ??= "redis://localhost:6379";
    return import("./notification-webhook-state");
  }

  async function loadEnvModule() {
    process.env.DATABASE_URL ??= "postgres://example:example@localhost:5432/neuroloom";
    process.env.REDIS_URL ??= "redis://localhost:6379";
    return import("./env");
  }

  async function loadContractsModule() {
    return import("@neuro/contracts");
  }

  const alertPayload = {
    alertLevel: 3,
    severity: "danger",
    title: "自动补救出现硬失败",
    detail: "当前有 3 条 callback 在自动补救阶段执行失败。",
    actionLabel: "查看 attempt failed",
    reasonCategory: "attempt_failed",
    reasonDisposition: "failed",
    policyKey: "balanced",
    count: 3,
    candidateCount: 12,
    maxAlertLevel: 3,
    scopeAgentId: "agent-123",
    agentName: "External Builder",
    agentOwnerUserId: "user-123",
    scopeCallbackType: "status",
  };

  const runtimeAlertPayload = {
    alertLevel: 3,
    severity: "danger",
    title: "Runtime profile 已进入 critical backlog",
    detail: "baseline profile 已出现 queue backlog，需要 operator 立即处理。",
    actionLabel: "查看 runtime pressure",
    profileKey: "baseline",
    pressureLevel: "critical",
    schedulingDecisionClass: "profile_and_owner_saturated",
    queuedExecutionCount: 6,
    runningExecutionCount: 4,
    ownerUserId: "user-ops",
    busiestOwnerRunningCount: 3,
    saturatedOwnerCount: 2,
    maxAlertLevel: 3,
  };

  const gatewayAlertPayload = {
    alertLevel: 3,
    severity: "danger",
    title: "AI gateway anomaly 需要紧急处理",
    detail: "project_alpha 上的 failure_rate_spike 已连续命中，需要 operator 处理。",
    actionLabel: "查看 gateway anomalies",
    reasonCategory: "failure_rate_spike",
    followUpStatus: "investigating",
    policyId: "policy-gateway-critical",
    count: 4,
    candidateCount: 2,
    maxAlertLevel: 3,
    projectId: "project_alpha",
    incidentId: "incident_123",
    ownerUserId: "user_gateway_owner",
    routePolicyId: "route_project_alpha",
  };

  const gatewayRemediationEffectivenessAlertPayload = {
    alertLevel: 2,
    severity: "warning",
    title: "AI gateway remediation effectiveness anomaly 进入观察态",
    detail: "route_project_alpha 的 completion_effectiveness_regressed 需要 operator 复核。",
    actionLabel: "查看 remediation effectiveness anomalies",
    reasonCategory: "completion_effectiveness_regressed",
    reasonDisposition: "balanced",
    profileKey: "balanced",
    count: 3,
    candidateCount: 1,
    maxAlertLevel: 2,
    routePolicyId: "route_project_alpha",
    snapshotId: "snapshot_remediation_123",
    criticalCount: 1,
  };

  const gatewayRateLimitHotspotAlertPayload = {
    alertLevel: 2,
    severity: "warning",
    title: "AI gateway rate-limit hotspot anomaly 进入观察态",
    detail: "project_alpha / route_project_alpha 上的 model_limit_rate_spike 需要 operator 复核。",
    actionLabel: "查看 rate-limit hotspot anomalies",
    reasonCategory: "model_limit_rate_spike",
    reasonDisposition: "balanced",
    profileKey: "balanced",
    count: 5,
    candidateCount: 2,
    maxAlertLevel: 2,
    projectId: "project_alpha",
    routePolicyId: "route_project_alpha",
    snapshotId: "snapshot_rate_limit_123",
    criticalCount: 2,
  };

  it("builds a vendor-neutral callback remediation alert payload", async () => {
    const { buildCallbackRemediationAlertWebhookPayload } = await loadWebhookModule();
    const payload = buildCallbackRemediationAlertWebhookPayload(alertPayload);

    assert.equal(payload.eventName, "agentExecution.callbackRemediationAlerted");
    assert.equal(payload.source, "neuroloom-account-worker");
    assert.equal(payload.alertKey, "callback-remediation:3:attempt_failed:failed:balanced:agent-123:status");
    assert.equal(payload.scope.agentId, "agent-123");
    assert.equal(payload.scope.agentName, "External Builder");
    assert.equal(payload.scope.agentOwnerUserId, "user-123");
    assert.equal(payload.scope.callbackType, "status");
    assert.equal(
      payload.operatorPath,
      "/ops/agent-callbacks?status=rejected&agentId=agent-123&callbackType=status&autoRemediationReasonCategory=attempt_failed&autoRemediationReasonDisposition=failed&remediationPolicyKey=balanced",
    );
    assert.equal(
      payload.operatorUrl,
      "https://app.example.com/ops/agent-callbacks?status=rejected&agentId=agent-123&callbackType=status&autoRemediationReasonCategory=attempt_failed&autoRemediationReasonDisposition=failed&remediationPolicyKey=balanced",
    );
  });

  it("builds a Slack-friendly payload when requested", async () => {
    const { buildNotificationWebhookPayload } = await loadWebhookModule();
    const payload = buildNotificationWebhookPayload(
      "agentExecution.callbackRemediationAlerted",
      alertPayload,
      "slack",
    ) as {
      text: string;
      blocks: Array<Record<string, unknown>>;
    };

    assert.match(payload.text, /L3 \/ Danger/);
    assert.ok(Array.isArray(payload.blocks));
    assert.equal(payload.blocks[0]?.type, "header");
    assert.equal(payload.blocks[payload.blocks.length - 1]?.type, "actions");
  });

  it("builds a vendor-neutral runtime pressure alert payload", async () => {
    const { buildRuntimePressureAlertWebhookPayload } = await loadWebhookModule();
    const payload = buildRuntimePressureAlertWebhookPayload(runtimeAlertPayload);

    assert.equal(payload.eventName, "agentExecution.runtimePressureAlerted");
    assert.equal(payload.alertKey, "runtime-pressure:3:baseline:critical:profile_and_owner_saturated:user-ops");
    assert.equal(payload.runtime.profileKey, "baseline");
    assert.equal(payload.runtime.ownerUserId, "user-ops");
    assert.equal(payload.runtime.queuedExecutionCount, 6);
    assert.equal(payload.runtime.runningExecutionCount, 4);
    assert.equal(
      payload.operatorPath,
      "/ops/agent-callbacks?runtimePressureLevel=critical&runtimeSchedulingDecisionClass=profile_and_owner_saturated#runtime-pressure",
    );
    assert.equal(
      payload.operatorUrl,
      "https://app.example.com/ops/agent-callbacks?runtimePressureLevel=critical&runtimeSchedulingDecisionClass=profile_and_owner_saturated#runtime-pressure",
    );
  });

  it("builds a Discord-friendly payload when requested", async () => {
    const { buildNotificationWebhookPayload } = await loadWebhookModule();
    const payload = buildNotificationWebhookPayload(
      "agentExecution.callbackRemediationAlerted",
      alertPayload,
      "discord",
    ) as {
      content?: string;
      embeds: Array<Record<string, unknown>>;
    };

    assert.match(payload.content ?? "", /https:\/\/app\.example\.com\/ops\/agent-callbacks/);
    assert.equal(payload.embeds.length, 1);
    assert.equal(payload.embeds[0]?.title, "Callback remediation alert L3");
  });

  it("builds a vendor-neutral gateway anomaly alert payload", async () => {
    const { buildGatewayAnomalyIncidentAlertWebhookPayload } = await loadWebhookModule();
    const payload = buildGatewayAnomalyIncidentAlertWebhookPayload(gatewayAlertPayload);

    assert.equal(payload.eventName, "aiGateway.anomalyIncidentAlerted");
    assert.equal(
      payload.alertKey,
      "gateway-anomaly:3:failure_rate_spike:investigating:policy-gateway-critical:project_alpha:incident_123",
    );
    assert.equal(payload.scope.projectId, "project_alpha");
    assert.equal(payload.scope.incidentId, "incident_123");
    assert.equal(payload.scope.ownerUserId, "user_gateway_owner");
    assert.equal(payload.scope.routePolicyId, "route_project_alpha");
    assert.equal(
      payload.operatorPath,
      "/ops/account/issues?projectId=project_alpha&incidentId=incident_123&gatewayAnomalyCode=failure_rate_spike&followUpStatus=investigating&policyId=policy-gateway-critical#gateway-anomalies",
    );
  });

  it("builds a vendor-neutral gateway remediation effectiveness anomaly alert payload", async () => {
    const { buildGatewayRemediationEffectivenessAnomalyAlertWebhookPayload } = await loadWebhookModule();
    const payload = buildGatewayRemediationEffectivenessAnomalyAlertWebhookPayload(
      gatewayRemediationEffectivenessAlertPayload,
    );

    assert.equal(payload.eventName, "aiGateway.remediationEffectivenessAnomalyAlerted");
    assert.equal(
      payload.alertKey,
      "gateway-remediation-effectiveness-anomaly:2:completion_effectiveness_regressed:balanced:route_project_alpha:snapshot_remediation_123:balanced",
    );
    assert.equal(payload.scope.routePolicyId, "route_project_alpha");
    assert.equal(payload.scope.snapshotId, "snapshot_remediation_123");
    assert.equal(payload.scope.criticalCount, 1);
    assert.equal(
      payload.operatorPath,
      "/ops/account/issues?snapshotId=snapshot_remediation_123&routePolicyId=route_project_alpha&gatewayRemediationAnomalyCode=completion_effectiveness_regressed&profileKey=balanced#gateway-remediation-effectiveness",
    );
    assert.equal(
      payload.operatorUrl,
      "https://app.example.com/ops/account/issues?snapshotId=snapshot_remediation_123&routePolicyId=route_project_alpha&gatewayRemediationAnomalyCode=completion_effectiveness_regressed&profileKey=balanced#gateway-remediation-effectiveness",
    );
  });

  it("builds a vendor-neutral gateway rate-limit hotspot anomaly alert payload", async () => {
    const { buildGatewayRateLimitHotspotAnomalyAlertWebhookPayload } = await loadWebhookModule();
    const payload = buildGatewayRateLimitHotspotAnomalyAlertWebhookPayload(gatewayRateLimitHotspotAlertPayload);

    assert.equal(payload.eventName, "aiGateway.rateLimitHotspotAnomalyAlerted");
    assert.equal(
      payload.alertKey,
      "gateway-rate-limit-hotspot-anomaly:2:model_limit_rate_spike:balanced:route_project_alpha:project_alpha:snapshot_rate_limit_123",
    );
    assert.equal(payload.scope.projectId, "project_alpha");
    assert.equal(payload.scope.routePolicyId, "route_project_alpha");
    assert.equal(payload.scope.snapshotId, "snapshot_rate_limit_123");
    assert.equal(payload.scope.criticalCount, 2);
    assert.equal(
      payload.operatorPath,
      "/ops/account/issues?projectId=project_alpha&snapshotId=snapshot_rate_limit_123&routePolicyId=route_project_alpha&gatewayRateLimitAnomalyCode=model_limit_rate_spike&profileKey=balanced#gateway-rate-limit-hotspots",
    );
    assert.equal(
      payload.operatorUrl,
      "https://app.example.com/ops/account/issues?projectId=project_alpha&snapshotId=snapshot_rate_limit_123&routePolicyId=route_project_alpha&gatewayRateLimitAnomalyCode=model_limit_rate_spike&profileKey=balanced#gateway-rate-limit-hotspots",
    );
  });

  it("builds a Feishu-friendly payload when requested", async () => {
    const { buildNotificationWebhookPayload } = await loadWebhookModule();
    const payload = buildNotificationWebhookPayload(
      "agentExecution.callbackRemediationAlerted",
      alertPayload,
      "feishu",
    ) as {
      msg_type: string;
      content: {
        post: {
          zh_cn: {
            title: string;
            content: Array<Array<Record<string, string>>>;
          };
        };
      };
    };

    assert.equal(payload.msg_type, "post");
    assert.equal(payload.content.post.zh_cn.title, "Callback remediation alert L3");
    assert.ok(
      payload.content.post.zh_cn.content.some((row) =>
        row.some((cell) => cell.tag === "a" && /https:\/\/app\.example\.com\/ops\/agent-callbacks/.test(cell.href ?? "")),
      ),
    );
  });

  it("selects provider routes by alert level, policy, and reason before the default target", async () => {
    const { selectNotificationWebhookTargetsForConfig } = await loadWebhookModule();
    const targets = selectNotificationWebhookTargetsForConfig(
      "agentExecution.callbackRemediationAlerted",
      alertPayload,
      {
        defaultTarget: {
          name: "default",
          url: "https://fallback.example.com/webhook",
          format: "generic",
          authToken: null,
          signingSecret: null,
          timeoutMs: 5000,
        },
        routes: [
          {
            name: "l3-slack",
            url: "https://hooks.slack.com/services/example",
            profileKey: null,
            format: "slack",
            eventNames: ["agentExecution.callbackRemediationAlerted"],
            minAlertLevel: 3,
            maxAlertLevel: null,
            minCount: null,
            maxCount: null,
            minCandidateCount: null,
            maxCandidateCount: null,
            policyKeys: ["balanced"],
            reasonCategories: ["attempt_failed"],
            reasonDispositions: [],
            callbackTypes: [],
            stopAfterMatch: false,
            minActiveMinutes: null,
            cooldownMinutes: null,
            maxDeliveriesPerIncident: null,
            authToken: null,
            signingSecret: null,
            timeoutMs: 5000,
          },
          {
            name: "l2-discord",
            url: "https://discord.example.com/api/webhooks/example",
            profileKey: null,
            format: "discord",
            eventNames: ["agentExecution.callbackRemediationAlerted"],
            minAlertLevel: 2,
            maxAlertLevel: 2,
            minCount: null,
            maxCount: null,
            minCandidateCount: null,
            maxCandidateCount: null,
            policyKeys: [],
            reasonCategories: [],
            reasonDispositions: [],
            callbackTypes: [],
            stopAfterMatch: false,
            minActiveMinutes: null,
            cooldownMinutes: null,
            maxDeliveriesPerIncident: null,
            authToken: null,
            signingSecret: null,
            timeoutMs: 5000,
          },
        ],
      },
    );

    assert.deepEqual(
      targets.map((target) => ({ name: target.name, format: target.format })),
      [{ name: "l3-slack", format: "slack" }],
    );
  });

  it("falls back to the default target when no route matches", async () => {
    const { selectNotificationWebhookTargetsForConfig } = await loadWebhookModule();
    const targets = selectNotificationWebhookTargetsForConfig(
      "agentExecution.callbackRemediationAlerted",
      { ...alertPayload, alertLevel: 1, policyKey: "strict", reasonCategory: "policy_disabled" },
      {
        defaultTarget: {
          name: "default",
          url: "https://fallback.example.com/webhook",
          format: "generic",
          authToken: "token",
          signingSecret: null,
          timeoutMs: 4000,
        },
        routes: [
          {
            name: "danger-only",
            url: "https://hooks.slack.com/services/example",
            profileKey: null,
            format: "slack",
            eventNames: ["agentExecution.callbackRemediationAlerted"],
            minAlertLevel: 3,
            maxAlertLevel: null,
            minCount: null,
            maxCount: null,
            minCandidateCount: null,
            maxCandidateCount: null,
            policyKeys: ["balanced"],
            reasonCategories: ["attempt_failed"],
            reasonDispositions: [],
            callbackTypes: [],
            stopAfterMatch: false,
            minActiveMinutes: null,
            cooldownMinutes: null,
            maxDeliveriesPerIncident: null,
            authToken: null,
            signingSecret: null,
            timeoutMs: 5000,
          },
        ],
      },
    );

    assert.equal(targets.length, 1);
    assert.equal(targets[0]?.name, "default");
    assert.equal(targets[0]?.format, "generic");
  });

  it("fans out to an escalation route when count and disposition thresholds are met", async () => {
    const { selectNotificationWebhookTargetsForConfig } = await loadWebhookModule();
    const targets = selectNotificationWebhookTargetsForConfig(
      "agentExecution.callbackRemediationAlerted",
      alertPayload,
      {
        defaultTarget: null,
        routes: [
          {
            name: "primary-slack",
            url: "https://hooks.slack.com/services/example",
            profileKey: null,
            format: "slack",
            eventNames: ["agentExecution.callbackRemediationAlerted"],
            minAlertLevel: 3,
            maxAlertLevel: null,
            minCount: null,
            maxCount: null,
            minCandidateCount: null,
            maxCandidateCount: null,
            policyKeys: ["balanced"],
            reasonCategories: ["attempt_failed"],
            reasonDispositions: ["failed"],
            callbackTypes: ["status"],
            stopAfterMatch: false,
            minActiveMinutes: null,
            cooldownMinutes: null,
            maxDeliveriesPerIncident: null,
            authToken: null,
            signingSecret: null,
            timeoutMs: 5000,
          },
          {
            name: "escalation-feishu",
            url: "https://open.feishu.cn/open-apis/bot/v2/hook/example",
            profileKey: null,
            format: "feishu",
            eventNames: ["agentExecution.callbackRemediationAlerted"],
            minAlertLevel: 3,
            maxAlertLevel: null,
            minCount: 3,
            maxCount: null,
            minCandidateCount: 10,
            maxCandidateCount: null,
            policyKeys: ["balanced"],
            reasonCategories: ["attempt_failed"],
            reasonDispositions: ["failed"],
            callbackTypes: ["status"],
            stopAfterMatch: false,
            minActiveMinutes: null,
            cooldownMinutes: null,
            maxDeliveriesPerIncident: null,
            authToken: null,
            signingSecret: null,
            timeoutMs: 5000,
          },
        ],
      },
    );

    assert.deepEqual(
      targets.map((target) => ({ name: target.name, format: target.format })),
      [
        { name: "primary-slack", format: "slack" },
        { name: "escalation-feishu", format: "feishu" },
      ],
    );
  });

  it("matches runtime pressure routes using alert, queue, and running thresholds", async () => {
    const { selectNotificationWebhookTargetsForConfig } = await loadWebhookModule();
    const targets = selectNotificationWebhookTargetsForConfig(
      "agentExecution.runtimePressureAlerted",
      runtimeAlertPayload,
      {
        defaultTarget: null,
        routes: [
          {
            name: "runtime-critical-slack",
            url: "https://hooks.slack.com/services/runtime",
            profileKey: null,
            format: "slack",
            eventNames: ["agentExecution.runtimePressureAlerted"],
            minAlertLevel: 3,
            maxAlertLevel: null,
            minCount: 5,
            maxCount: null,
            minCandidateCount: 4,
            maxCandidateCount: null,
            policyKeys: [],
            reasonCategories: [],
            reasonDispositions: [],
            callbackTypes: [],
            stopAfterMatch: false,
            minActiveMinutes: null,
            cooldownMinutes: null,
            maxDeliveriesPerIncident: null,
            authToken: null,
            signingSecret: null,
            timeoutMs: 5000,
          },
          {
            name: "callback-only-route",
            url: "https://hooks.slack.com/services/callback-only",
            profileKey: null,
            format: "slack",
            eventNames: ["agentExecution.runtimePressureAlerted"],
            minAlertLevel: 3,
            maxAlertLevel: null,
            minCount: null,
            maxCount: null,
            minCandidateCount: null,
            maxCandidateCount: null,
            policyKeys: ["balanced"],
            reasonCategories: [],
            reasonDispositions: [],
            callbackTypes: [],
            stopAfterMatch: false,
            minActiveMinutes: null,
            cooldownMinutes: null,
            maxDeliveriesPerIncident: null,
            authToken: null,
            signingSecret: null,
            timeoutMs: 5000,
          },
        ],
      },
    );

    assert.deepEqual(
      targets.map((target) => ({ name: target.name, format: target.format })),
      [{ name: "runtime-critical-slack", format: "slack" }],
    );
  });

  it("supports exclusive routing with stopAfterMatch", async () => {
    const { selectNotificationWebhookTargetsForConfig } = await loadWebhookModule();
    const targets = selectNotificationWebhookTargetsForConfig(
      "agentExecution.callbackRemediationAlerted",
      alertPayload,
      {
        defaultTarget: {
          name: "default",
          url: "https://fallback.example.com/webhook",
          format: "generic",
          authToken: null,
          signingSecret: null,
          timeoutMs: 5000,
        },
        routes: [
          {
            name: "exclusive-primary",
            url: "https://hooks.slack.com/services/example",
            profileKey: null,
            format: "slack",
            eventNames: ["agentExecution.callbackRemediationAlerted"],
            minAlertLevel: 3,
            maxAlertLevel: null,
            minCount: null,
            maxCount: null,
            minCandidateCount: null,
            maxCandidateCount: null,
            policyKeys: [],
            reasonCategories: [],
            reasonDispositions: [],
            callbackTypes: [],
            stopAfterMatch: true,
            minActiveMinutes: null,
            cooldownMinutes: null,
            maxDeliveriesPerIncident: null,
            authToken: null,
            signingSecret: null,
            timeoutMs: 5000,
          },
          {
            name: "secondary-escalation",
            url: "https://discord.example.com/api/webhooks/example",
            profileKey: null,
            format: "discord",
            eventNames: ["agentExecution.callbackRemediationAlerted"],
            minAlertLevel: 3,
            maxAlertLevel: null,
            minCount: null,
            maxCount: null,
            minCandidateCount: null,
            maxCandidateCount: null,
            policyKeys: [],
            reasonCategories: [],
            reasonDispositions: [],
            callbackTypes: [],
            stopAfterMatch: false,
            minActiveMinutes: null,
            cooldownMinutes: null,
            maxDeliveriesPerIncident: null,
            authToken: null,
            signingSecret: null,
            timeoutMs: 5000,
          },
        ],
      },
    );

    assert.deepEqual(
      targets.map((target) => ({ name: target.name, format: target.format })),
      [{ name: "exclusive-primary", format: "slack" }],
    );
  });

  it("lets a route inherit paging defaults from a named profile while still overriding local match fields", async () => {
    const { parseNotificationWebhookRouteProfiles, parseNotificationWebhookRoutes } = await loadEnvModule();
    const profiles = parseNotificationWebhookRouteProfiles(
      JSON.stringify([
        {
          key: "l3-escalation",
          format: "feishu",
          eventNames: ["agentExecution.callbackRemediationAlerted"],
          minAlertLevel: 3,
          reasonCategories: ["attempt_failed"],
          reasonDispositions: ["failed"],
          callbackTypes: ["status"],
          minActiveMinutes: 15,
          cooldownMinutes: 60,
          maxDeliveriesPerIncident: 2,
          stopAfterMatch: false,
          timeoutMs: 9000,
        },
      ]),
      ["agentExecution.callbackRemediationAlerted"],
      "generic",
      5000,
    );
    const routes = parseNotificationWebhookRoutes(
      JSON.stringify([
        {
          name: "l3-escalation-feishu",
          profileKey: "l3-escalation",
          url: "https://open.feishu.cn/open-apis/bot/v2/hook/example",
          policyKeys: ["balanced"],
          minCandidateCount: 10,
        },
      ]),
      profiles,
      ["agentExecution.callbackRemediationAlerted"],
      "generic",
      5000,
    );

    assert.equal(routes.length, 1);
    assert.equal(routes[0]?.profileKey, "l3-escalation");
    assert.equal(routes[0]?.format, "feishu");
    assert.deepEqual(routes[0]?.policyKeys, ["balanced"]);
    assert.deepEqual(routes[0]?.reasonCategories, ["attempt_failed"]);
    assert.equal(routes[0]?.minCandidateCount, 10);
    assert.equal(routes[0]?.minActiveMinutes, 15);
    assert.equal(routes[0]?.cooldownMinutes, 60);
    assert.equal(routes[0]?.maxDeliveriesPerIncident, 2);
    assert.equal(routes[0]?.timeoutMs, 9000);
  });

  it("builds a sanitized notification webhook catalog for operator visibility", async () => {
    const { buildNotificationWebhookCatalogView } = await loadContractsModule();
    const catalog = buildNotificationWebhookCatalogView({
      enabledEventNames: ["agentExecution.callbackRemediationAlerted"],
      defaultTarget: {
        url: "https://hooks.slack.com/services/example/primary/secret",
        format: "slack",
        authToken: "token",
        signingSecret: null,
        timeoutMs: 5000,
      },
      profiles: [
        {
          key: "l3-escalation",
          format: "feishu",
          eventNames: ["agentExecution.callbackRemediationAlerted"],
          minAlertLevel: 3,
          maxAlertLevel: null,
          minCount: null,
          maxCount: null,
          minCandidateCount: 10,
          maxCandidateCount: null,
          policyKeys: ["balanced"],
          reasonCategories: ["attempt_failed"],
          reasonDispositions: ["failed"],
          callbackTypes: ["status"],
          stopAfterMatch: false,
          minActiveMinutes: 15,
          cooldownMinutes: 60,
          maxDeliveriesPerIncident: 2,
          timeoutMs: 9000,
        },
      ],
      routes: [
        {
          name: "discord-escalation",
          url: "https://discord.com/api/webhooks/example/secret",
          profileKey: "l3-escalation",
          format: "discord",
          eventNames: ["agentExecution.callbackRemediationAlerted"],
          minAlertLevel: 3,
          maxAlertLevel: null,
          minCount: 3,
          maxCount: null,
          minCandidateCount: 10,
          maxCandidateCount: null,
          policyKeys: ["balanced"],
          reasonCategories: ["attempt_failed"],
          reasonDispositions: ["failed"],
          callbackTypes: ["status"],
          stopAfterMatch: false,
          minActiveMinutes: 15,
          cooldownMinutes: 60,
          maxDeliveriesPerIncident: 2,
          authToken: null,
          signingSecret: "signed",
          timeoutMs: 7000,
        },
      ],
    });

    assert.equal(catalog.defaultTarget?.destinationLabel, "hooks.slack.com (4 path segments)");
    assert.equal(catalog.defaultTarget?.hasAuthToken, true);
    assert.equal(catalog.defaultTarget?.hasSigningSecret, false);
    assert.equal(catalog.profiles[0]?.routeCount, 1);
    assert.equal(catalog.routes[0]?.destinationLabel, "discord.com (4 path segments)");
    assert.equal(catalog.routes[0]?.profileKey, "l3-escalation");
    assert.equal(catalog.routes[0]?.hasSigningSecret, true);
  });

  it("parses callback remediation incident keys into operator-facing slices", async () => {
    const { parseNotificationWebhookIncidentKey } = await loadContractsModule();
    const incident = parseNotificationWebhookIncidentKey(
      "callback-remediation:3:attempt_failed:failed:balanced:agent-123:status",
    );

    assert.equal(incident?.eventName, "agentExecution.callbackRemediationAlerted");
    assert.equal(incident?.alertLevel, 3);
    assert.equal(incident?.reasonCategory, "attempt_failed");
    assert.equal(incident?.reasonDisposition, "failed");
    assert.equal(incident?.policyKey, "balanced");
    assert.equal(incident?.agentId, "agent-123");
    assert.equal(incident?.callbackType, "status");
  });

  it("parses runtime pressure incident keys into operator-facing slices", async () => {
    const { defaultNotificationWebhookEventNames, parseNotificationWebhookIncidentKey } = await loadContractsModule();
    const incident = parseNotificationWebhookIncidentKey(
      "runtime-pressure:3:baseline:critical:profile_and_owner_saturated:user-ops",
    );

    assert.ok(defaultNotificationWebhookEventNames.includes("agentExecution.runtimePressureAlerted"));
    assert.equal(incident?.eventName, "agentExecution.runtimePressureAlerted");
    assert.equal(incident?.alertLevel, 3);
    assert.equal(incident?.profileKey, "baseline");
    assert.equal(incident?.pressureLevel, "critical");
    assert.equal(incident?.schedulingDecisionClass, "profile_and_owner_saturated");
    assert.equal(incident?.ownerUserId, "user-ops");
    assert.equal(incident?.policyKey, null);
    assert.equal(incident?.reasonCategory, null);
  });

  it("parses ai gateway anomaly incident keys into operator-facing slices", async () => {
    const { parseNotificationWebhookIncidentKey } = await loadContractsModule();
    const incident = parseNotificationWebhookIncidentKey(
      "gateway-anomaly:3:failure_rate_spike:investigating:policy-gateway-critical:project_alpha:incident_123",
    );

    assert.equal(incident?.eventName, "aiGateway.anomalyIncidentAlerted");
    assert.equal(incident?.alertLevel, 3);
    assert.equal(incident?.reasonCategory, "failure_rate_spike");
    assert.equal(incident?.reasonDisposition, "investigating");
    assert.equal(incident?.policyKey, "policy-gateway-critical");
    assert.equal(incident?.projectId, "project_alpha");
    assert.equal(incident?.incidentId, "incident_123");
  });

  it("parses remediation effectiveness anomaly incident keys into operator-facing slices", async () => {
    const { parseNotificationWebhookIncidentKey } = await loadContractsModule();
    const incident = parseNotificationWebhookIncidentKey(
      "gateway-remediation-effectiveness-anomaly:2:completion_effectiveness_regressed:balanced:route_project_alpha:snapshot_remediation_123:balanced",
    );

    assert.equal(incident?.eventName, "aiGateway.remediationEffectivenessAnomalyAlerted");
    assert.equal(incident?.alertLevel, 2);
    assert.equal(incident?.reasonCategory, "completion_effectiveness_regressed");
    assert.equal(incident?.reasonDisposition, "balanced");
    assert.equal(incident?.policyKey, "balanced");
    assert.equal(incident?.profileKey, "balanced");
    assert.equal(incident?.routePolicyId, "route_project_alpha");
    assert.equal(incident?.snapshotId, "snapshot_remediation_123");
    assert.equal(incident?.incidentId, null);
  });

  it("parses rate-limit hotspot anomaly incident keys into operator-facing slices", async () => {
    const { parseNotificationWebhookIncidentKey } = await loadContractsModule();
    const incident = parseNotificationWebhookIncidentKey(
      "gateway-rate-limit-hotspot-anomaly:2:model_limit_rate_spike:balanced:route_project_alpha:project_alpha:snapshot_rate_limit_123",
    );

    assert.equal(incident?.eventName, "aiGateway.rateLimitHotspotAnomalyAlerted");
    assert.equal(incident?.alertLevel, 2);
    assert.equal(incident?.reasonCategory, "model_limit_rate_spike");
    assert.equal(incident?.reasonDisposition, "balanced");
    assert.equal(incident?.policyKey, "balanced");
    assert.equal(incident?.profileKey, "balanced");
    assert.equal(incident?.projectId, "project_alpha");
    assert.equal(incident?.routePolicyId, "route_project_alpha");
    assert.equal(incident?.snapshotId, "snapshot_rate_limit_123");
  });

  it("matches remediation effectiveness anomaly routes using alert, profile, and route scope", async () => {
    const { selectNotificationWebhookTargetsForConfig } = await loadWebhookModule();
    const targets = selectNotificationWebhookTargetsForConfig(
      "aiGateway.remediationEffectivenessAnomalyAlerted",
      gatewayRemediationEffectivenessAlertPayload,
      {
        defaultTarget: {
          name: "default",
          url: "https://fallback.example.com/webhook",
          format: "generic",
          authToken: null,
          signingSecret: null,
          timeoutMs: 4000,
        },
        routes: [
          {
            name: "remediation-watch",
            url: "https://hooks.slack.com/services/example",
            profileKey: null,
            format: "slack",
            eventNames: ["aiGateway.remediationEffectivenessAnomalyAlerted"],
            minAlertLevel: 2,
            maxAlertLevel: null,
            minCount: null,
            maxCount: null,
            minCandidateCount: null,
            maxCandidateCount: null,
            policyKeys: ["balanced"],
            reasonCategories: ["completion_effectiveness_regressed"],
            reasonDispositions: ["balanced"],
            callbackTypes: [],
            stopAfterMatch: false,
            minActiveMinutes: null,
            cooldownMinutes: null,
            maxDeliveriesPerIncident: null,
            authToken: null,
            signingSecret: null,
            timeoutMs: 5000,
          },
        ],
      },
    );

    assert.deepEqual(
      targets.map((target) => ({ name: target.name, format: target.format })),
      [{ name: "remediation-watch", format: "slack" }],
    );
  });

  it("matches rate-limit hotspot anomaly routes using alert, profile, and route scope", async () => {
    const { selectNotificationWebhookTargetsForConfig } = await loadWebhookModule();
    const targets = selectNotificationWebhookTargetsForConfig(
      "aiGateway.rateLimitHotspotAnomalyAlerted",
      gatewayRateLimitHotspotAlertPayload,
      {
        defaultTarget: {
          name: "default",
          url: "https://fallback.example.com/webhook",
          format: "generic",
          authToken: null,
          signingSecret: null,
          timeoutMs: 4000,
        },
        routes: [
          {
            name: "rate-limit-watch",
            url: "https://hooks.slack.com/services/example",
            profileKey: null,
            format: "slack",
            eventNames: ["aiGateway.rateLimitHotspotAnomalyAlerted"],
            minAlertLevel: 2,
            maxAlertLevel: null,
            minCount: null,
            maxCount: null,
            minCandidateCount: null,
            maxCandidateCount: null,
            policyKeys: ["balanced"],
            reasonCategories: ["model_limit_rate_spike"],
            reasonDispositions: ["balanced"],
            callbackTypes: [],
            stopAfterMatch: false,
            minActiveMinutes: null,
            cooldownMinutes: null,
            maxDeliveriesPerIncident: null,
            authToken: null,
            signingSecret: null,
            timeoutMs: 5000,
          },
        ],
      },
    );

    assert.deepEqual(
      targets.map((target) => ({ name: target.name, format: target.format })),
      [{ name: "rate-limit-watch", format: "slack" }],
    );
  });

  it("classifies a silenced incident as blocked before other cadence rules", async () => {
    const { evaluateNotificationWebhookRoutePolicy } = await loadContractsModule();
    const referenceTime = new Date("2026-03-25T10:00:00.000Z");
    const decision = evaluateNotificationWebhookRoutePolicy({
      route: {
        minActiveMinutes: 15,
        cooldownMinutes: 30,
        maxDeliveriesPerIncident: 2,
      },
      state: {
        firstSeenAt: new Date("2026-03-25T09:00:00.000Z"),
        lastSeenAt: new Date("2026-03-25T09:58:00.000Z"),
        lastSentAt: new Date("2026-03-25T09:45:00.000Z"),
        sendCount: 1,
        silencedUntil: new Date("2026-03-25T10:30:00.000Z"),
      },
      referenceTime,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "silenced");
    assert.equal(decision.silenceRemainingMinutes, 30);
  });

  it("resolves governance state from acknowledgement and active silence", async () => {
    const { buildNotificationWebhookIncidentControlState, resolveNotificationWebhookIncidentGovernanceState } =
      await loadContractsModule();
    const referenceTime = new Date("2026-03-25T10:00:00.000Z");

    const acknowledged = resolveNotificationWebhookIncidentGovernanceState({
      control: buildNotificationWebhookIncidentControlState({
        acknowledgedAt: "2026-03-25T09:30:00.000Z",
        acknowledgedByUserId: "operator-1",
        silencedAt: null,
        silencedUntil: null,
        silencedByUserId: null,
        silenceReason: null,
      }),
      referenceTime,
    });
    const silenced = resolveNotificationWebhookIncidentGovernanceState({
      control: buildNotificationWebhookIncidentControlState({
        acknowledgedAt: "2026-03-25T09:30:00.000Z",
        acknowledgedByUserId: "operator-1",
        silencedAt: "2026-03-25T09:45:00.000Z",
        silencedUntil: "2026-03-25T10:30:00.000Z",
        silencedByUserId: "operator-1",
        silenceReason: "known upstream outage",
      }),
      referenceTime,
    });

    assert.equal(acknowledged, "acknowledged");
    assert.equal(silenced, "silenced");
  });

  it("builds notification webhook incident history entries for operator lifecycle actions", async () => {
    const { buildNotificationWebhookIncidentHistoryEntry } = await loadContractsModule();
    const entry = buildNotificationWebhookIncidentHistoryEntry({
      incidentKey: "callback-remediation:3:attempt_failed:failed:balanced:agent-123:status",
      kind: "silenced",
      occurredAt: "2026-03-25T10:00:00.000Z",
      actorUserId: "operator-1",
      silencedUntil: "2026-03-25T11:00:00.000Z",
      reason: "known upstream outage",
    });

    assert.equal(entry.kind, "silenced");
    assert.equal(entry.actorUserId, "operator-1");
    assert.equal(entry.silencedUntil, "2026-03-25T11:00:00.000Z");
    assert.equal(entry.reason, "known upstream outage");
  });

  it("parses serialized notification webhook incident history entries", async () => {
    const { parseNotificationWebhookIncidentHistoryEntry } = await loadContractsModule();
    const entry = parseNotificationWebhookIncidentHistoryEntry(
      JSON.stringify({
        id: "hist-1",
        incidentKey: "callback-remediation:3:attempt_failed:failed:balanced:agent-123:status",
        kind: "delivered",
        occurredAt: "2026-03-25T10:05:00.000Z",
        actorUserId: null,
        routeName: "default",
        profileKey: null,
        format: "slack",
        silencedUntil: null,
        reason: null,
      }),
    );

    assert.equal(entry?.id, "hist-1");
    assert.equal(entry?.kind, "delivered");
    assert.equal(entry?.routeName, "default");
    assert.equal(entry?.format, "slack");
  });

  it("requires an alert to stay active before an escalation route becomes eligible", async () => {
    const { evaluateNotificationWebhookRoutePolicy } = await loadWebhookStateModule();
    const referenceTime = new Date("2026-03-25T10:00:00.000Z");
    const decision = evaluateNotificationWebhookRoutePolicy({
      route: {
        minActiveMinutes: 15,
        cooldownMinutes: null,
        maxDeliveriesPerIncident: null,
      },
      state: {
        firstSeenAt: new Date("2026-03-25T09:52:00.000Z"),
        lastSeenAt: new Date("2026-03-25T09:58:00.000Z"),
        lastSentAt: null,
        sendCount: 0,
        silencedUntil: null,
      },
      referenceTime,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "min_active_not_reached");
  });

  it("suppresses repeated delivery during the configured cooldown window", async () => {
    const { evaluateNotificationWebhookRoutePolicy } = await loadWebhookStateModule();
    const referenceTime = new Date("2026-03-25T10:00:00.000Z");
    const decision = evaluateNotificationWebhookRoutePolicy({
      route: {
        minActiveMinutes: null,
        cooldownMinutes: 30,
        maxDeliveriesPerIncident: null,
      },
      state: {
        firstSeenAt: new Date("2026-03-25T08:00:00.000Z"),
        lastSeenAt: new Date("2026-03-25T09:58:00.000Z"),
        lastSentAt: new Date("2026-03-25T09:45:00.000Z"),
        sendCount: 1,
        silencedUntil: null,
      },
      referenceTime,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "cooldown_active");
  });

  it("stops external paging after the configured per-incident delivery cap", async () => {
    const { evaluateNotificationWebhookRoutePolicy } = await loadWebhookStateModule();
    const referenceTime = new Date("2026-03-25T10:00:00.000Z");
    const decision = evaluateNotificationWebhookRoutePolicy({
      route: {
        minActiveMinutes: null,
        cooldownMinutes: null,
        maxDeliveriesPerIncident: 2,
      },
      state: {
        firstSeenAt: new Date("2026-03-25T08:00:00.000Z"),
        lastSeenAt: new Date("2026-03-25T09:58:00.000Z"),
        lastSentAt: new Date("2026-03-25T09:00:00.000Z"),
        sendCount: 2,
        silencedUntil: null,
      },
      referenceTime,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "max_deliveries_reached");
  });
});
