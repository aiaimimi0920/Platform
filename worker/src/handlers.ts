import type { EventName } from "@neuro/contracts";

import { pgPool } from "@/db";
import { env } from "@/env";
import { isModuleEnabled } from "@/feature-modules";

type HandlerResult = "processed" | "defer";
type EventHandler = (payload: Record<string, unknown>) => Promise<HandlerResult>;

async function noopHandler(): Promise<HandlerResult> {
  return "processed";
}

async function requireModulesEnabled(moduleKeys: string[]): Promise<boolean> {
  for (const moduleKey of moduleKeys) {
    const enabled = await isModuleEnabled(moduleKey as Parameters<typeof isModuleEnabled>[0]);
    if (!enabled) return false;
  }
  return true;
}

async function insertMailboxMessage(args: {
  userId: string;
  title: string;
  body: string;
  type: "system" | "reward" | "compensation";
  attachments?: Array<
    | { kind: "currency"; currency: "obsidian" | "mira" | "opinionTickets"; amount: number }
    | { kind: "item"; productId: string }
  >;
}) {
  const client = await pgPool.connect();
  try {
    await client.query("begin");
    const messageId = crypto.randomUUID();
    await client.query(
      `
        insert into mailbox_messages (id, user_id, title, body, type, read_at, expires_at, created_at)
        values ($1, $2, $3, $4, $5, null, null, now())
      `,
      [messageId, args.userId, args.title, args.body, args.type],
    );

    for (const attachment of args.attachments ?? []) {
      await client.query(
        `
          insert into mailbox_attachments (id, message_id, kind, currency, amount, product_id, item_id, claimed_at)
          values ($1, $2, $3, $4, $5, $6, null, null)
        `,
        [
          crypto.randomUUID(),
          messageId,
          attachment.kind,
          attachment.kind === "currency" ? attachment.currency : null,
          attachment.kind === "currency" ? attachment.amount : null,
          attachment.kind === "item" ? attachment.productId : null,
        ],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function getOrderPurchaseSummary(orderId: string): Promise<{ userId: string; productTitle: string } | null> {
  const result = await pgPool.query(
    `
      select o.user_id as "userId", p.title as "productTitle"
      from orders o
      join products p on p.id = o.product_id
      where o.id = $1
      limit 1
    `,
    [orderId],
  );

  const row = result.rows[0] as { userId: string; productTitle: string } | undefined;
  return row ?? null;
}

async function getRedemptionCode(codeId: string): Promise<string | null> {
  const result = await pgPool.query(
    `
      select code
      from redemption_codes
      where id = $1
      limit 1
    `,
    [codeId],
  );
  const row = result.rows[0] as { code: string } | undefined;
  return row?.code ?? null;
}

async function getItemSummary(itemId: string): Promise<{
  userId: string;
  productTitle: string;
  fulfillmentMode: string;
  replacementCount: number;
} | null> {
  const result = await pgPool.query(
    `
      select
        user_id as "userId",
        product_title as "productTitle",
        fulfillment_mode as "fulfillmentMode",
        replacement_count as "replacementCount"
      from items
      where id = $1
      limit 1
    `,
    [itemId],
  );
  const row = result.rows[0] as
    | { userId: string; productTitle: string; fulfillmentMode: string; replacementCount: number }
    | undefined;
  return row ?? null;
}

async function getItemUnitSummary(unitId: string): Promise<{
  itemId: string;
  code: string;
  issueReason: string | null;
  replacedByUnitId: string | null;
} | null> {
  const result = await pgPool.query(
    `
      select
        item_id as "itemId",
        code,
        issue_reason as "issueReason",
        replaced_by_unit_id as "replacedByUnitId"
      from item_units
      where id = $1
      limit 1
    `,
    [unitId],
  );
  const row = result.rows[0] as
    | { itemId: string; code: string; issueReason: string | null; replacedByUnitId: string | null }
    | undefined;
  return row ?? null;
}

async function getTaskSummary(taskId: string): Promise<{
  title: string;
  creatorUserId: string;
  assignedUserId: string | null;
} | null> {
  const result = await pgPool.query(
    `
      select
        title,
        creator_user_id as "creatorUserId",
        assigned_user_id as "assignedUserId"
      from tasks
      where id = $1
      limit 1
    `,
    [taskId],
  );
  const row = result.rows[0] as { title: string; creatorUserId: string; assignedUserId: string | null } | undefined;
  return row ?? null;
}

async function getOpinionTopicSummary(topicId: string): Promise<{
  title: string;
  creatorUserId: string;
} | null> {
  const result = await pgPool.query(
    `
      select
        title,
        creator_user_id as "creatorUserId"
      from opinion_topics
      where id = $1
      limit 1
    `,
    [topicId],
  );
  const row = result.rows[0] as { title: string; creatorUserId: string } | undefined;
  return row ?? null;
}

async function getDevelopmentQueueSummary(queueItemId: string): Promise<{
  title: string;
  ownerUserId: string;
  status: string;
} | null> {
  const result = await pgPool.query(
    `
      select
        title,
        owner_user_id as "ownerUserId",
        status
      from development_queue_items
      where id = $1
      limit 1
    `,
    [queueItemId],
  );
  const row = result.rows[0] as { title: string; ownerUserId: string; status: string } | undefined;
  return row ?? null;
}

async function getAgentExecutionSummary(executionId: string): Promise<{
  title: string;
  ownerUserId: string;
  status: string;
} | null> {
  const result = await pgPool.query(
    `
      select
        title,
        owner_user_id as "ownerUserId",
        status
      from agent_executions
      where id = $1
      limit 1
    `,
    [executionId],
  );
  const row = result.rows[0] as { title: string; ownerUserId: string; status: string } | undefined;
  return row ?? null;
}

async function getArbitrationCaseSummary(caseId: string): Promise<{
  entityType: string;
  entityId: string;
  requesterUserId: string;
  respondentUserId: string;
  status: string;
} | null> {
  const result = await pgPool.query(
    `
      select
        entity_type as "entityType",
        entity_id as "entityId",
        requester_user_id as "requesterUserId",
        respondent_user_id as "respondentUserId",
        status
      from arbitration_cases
      where id = $1
      limit 1
    `,
    [caseId],
  );
  const row = result.rows[0] as
    | {
        entityType: string;
        entityId: string;
        requesterUserId: string;
        respondentUserId: string;
        status: string;
      }
    | undefined;
  return row ?? null;
}

const handlers: Record<EventName, EventHandler> = {
  "user.registered": async (payload) => {
    if (!(await requireModulesEnabled(["mailbox"]))) return "processed";
    const userId = String(payload.userId || "");
    if (!userId) return "processed";
    await insertMailboxMessage({
      userId,
      title: "欢迎来到 NeuroLoom",
      body: "这是你的开发阶段欢迎礼包。先领取这些资源，用来测试商品、任务和站内经济系统。",
      type: "reward",
      attachments: [
        { kind: "currency", currency: "obsidian", amount: 240 },
        { kind: "currency", currency: "mira", amount: 160 },
      ],
    });
    return "processed";
  },
  "email.delivery.requested": async () => {
    return "processed";
  },
  "email.inbound.received": async () => {
    return "processed";
  },
  "dailyReward.claimed": async (payload) => {
    if (!(await requireModulesEnabled(["personalMissions", "mailbox"]))) return "processed";

    const userId = String(payload.userId || "");
    if (!userId) return "processed";

    const claimedAmount = Number(payload.claimedAmount || 0);
    const streakDays = Number(payload.streakDays || 0);

    await insertMailboxMessage({
      userId,
      title: "每日奖励已发放",
      body: `你已完成今日签到，获得 ${claimedAmount} 米拉，当前连续签到 ${streakDays} 天。`,
      type: "reward",
    });

    return "processed";
  },
  "mission.claimed": async (payload) => {
    if (!(await requireModulesEnabled(["personalMissions", "mailbox"]))) return "processed";

    const userId = String(payload.userId || "");
    if (!userId) return "processed";

    const missionKey = String(payload.missionKey || payload.missionId || "unknown");
    const claimedAmount = Number(payload.claimedAmount || 0);

    await insertMailboxMessage({
      userId,
      title: "任务奖励已发放",
      body: `你已领取任务 ${missionKey} 的奖励，本次获得 ${claimedAmount} 米拉。`,
      type: "reward",
    });

    return "processed";
  },
  "dailyMission.claimed": async (payload) => {
    if (!(await requireModulesEnabled(["personalMissions", "mailbox"]))) return "processed";

    const userId = String(payload.userId || "");
    if (!userId) return "processed";

    const missionKey = String(payload.missionKey || "");
    const claimedAmount = Number(payload.claimedAmount || 0);

    await insertMailboxMessage({
      userId,
      title: "日常任务奖励已发放",
      body: `你已领取日常任务 ${missionKey} 的奖励，本次获得 ${claimedAmount} 米拉。`,
      type: "reward",
    });

    return "processed";
  },
  "weeklyMission.claimed": async (payload) => {
    if (!(await requireModulesEnabled(["personalMissions", "mailbox"]))) return "processed";

    const userId = String(payload.userId || "");
    if (!userId) return "processed";

    const missionKey = String(payload.missionKey || "");
    const claimedAmount = Number(payload.claimedAmount || 0);

    await insertMailboxMessage({
      userId,
      title: "周常任务奖励已发放",
      body: `你已领取周常任务 ${missionKey} 的奖励，本次获得 ${claimedAmount} 米拉。`,
      type: "reward",
    });

    return "processed";
  },
  "opinionTopic.created": async (payload) => {
    if (!(await requireModulesEnabled(["opinionHub", "mailbox"]))) return "processed";

    const topicId = String(payload.topicId || "");
    const creatorUserId = String(payload.creatorUserId || "");
    if (!topicId || !creatorUserId) return "processed";

    const summary = await getOpinionTopicSummary(topicId);
    await insertMailboxMessage({
      userId: creatorUserId,
      title: "议题已创建",
      body: `你的议题${summary?.title ? `《${summary.title}》` : ""}已进入征集阶段，现在可以继续号召更多用户使用意见券支持。`,
      type: "system",
    });

    return "processed";
  },
  "opinionTopic.supported": async (payload) => {
    if (!(await requireModulesEnabled(["opinionHub", "mailbox"]))) return "processed";

    const topicId = String(payload.topicId || "");
    const supporterUserId = String(payload.supporterUserId || "");
    if (!topicId) return "processed";

    const summary = await getOpinionTopicSummary(topicId);
    if (!summary || summary.creatorUserId === supporterUserId) return "processed";

    await insertMailboxMessage({
      userId: summary.creatorUserId,
      title: "议题获得新的支持",
      body: `你的议题《${summary.title}》刚刚获得新的意见券支持。`,
      type: "system",
    });

    return "processed";
  },
  "opinionTopic.opposed": async (payload) => {
    if (!(await requireModulesEnabled(["opinionHub", "mailbox"]))) return "processed";

    const topicId = String(payload.topicId || "");
    const opposerUserId = String(payload.opposerUserId || "");
    if (!topicId) return "processed";

    const summary = await getOpinionTopicSummary(topicId);
    if (!summary || summary.creatorUserId === opposerUserId) return "processed";

    await insertMailboxMessage({
      userId: summary.creatorUserId,
      title: "议题收到新的反对票",
      body: `你的议题《${summary.title}》刚刚收到新的反对意见券，请关注当前支持率变化。`,
      type: "system",
    });

    return "processed";
  },
  "opinionTopic.qualified": async (payload) => {
    if (!(await requireModulesEnabled(["opinionHub", "mailbox"]))) return "processed";

    const topicId = String(payload.topicId || "");
    if (!topicId) return "processed";

    const summary = await getOpinionTopicSummary(topicId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.creatorUserId,
      title: "议题支持已达标",
      body: `你的议题《${summary.title}》已经达到当前支持门槛，现已进入 qualified 状态。`,
      type: "reward",
    });

    return "processed";
  },
  "opinionTopic.archived": async (payload) => {
    if (!(await requireModulesEnabled(["opinionHub", "mailbox"]))) return "processed";

    const topicId = String(payload.topicId || "");
    if (!topicId) return "processed";

    const summary = await getOpinionTopicSummary(topicId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.creatorUserId,
      title: "议题已归档",
      body: `你的议题《${summary.title}》已归档，当前不会再继续接受支持或进入推进流程。`,
      type: "system",
    });

    return "processed";
  },
  "opinionTopic.adopted": async (payload) => {
    if (!(await requireModulesEnabled(["opinionHub", "mailbox"]))) return "processed";

    const topicId = String(payload.topicId || "");
    if (!topicId) return "processed";

    const summary = await getOpinionTopicSummary(topicId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.creatorUserId,
      title: "议题已采纳",
      body: `你的议题《${summary.title}》已被采纳，可以进入后续开发排期讨论。`,
      type: "reward",
    });

    return "processed";
  },
  "developmentQueue.queued": async (payload) => {
    if (!(await requireModulesEnabled(["developmentQueue", "mailbox"]))) return "processed";

    const queueItemId = String(payload.queueItemId || "");
    if (!queueItemId) return "processed";

    const summary = await getDevelopmentQueueSummary(queueItemId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: "议题已进入开发排期",
      body: `《${summary.title}》已进入开发排期队列，当前状态为 queued。`,
      type: "system",
    });

    return "processed";
  },
  "developmentQueue.planned": async (payload) => {
    if (!(await requireModulesEnabled(["developmentQueue", "mailbox"]))) return "processed";

    const queueItemId = String(payload.queueItemId || "");
    if (!queueItemId) return "processed";

    const summary = await getDevelopmentQueueSummary(queueItemId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: "开发排期已规划",
      body: `《${summary.title}》已进入 planned 状态，可以开始安排具体实现。`,
      type: "system",
    });

    return "processed";
  },
  "developmentQueue.started": async (payload) => {
    if (!(await requireModulesEnabled(["developmentQueue", "mailbox"]))) return "processed";

    const queueItemId = String(payload.queueItemId || "");
    if (!queueItemId) return "processed";

    const summary = await getDevelopmentQueueSummary(queueItemId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: "开发任务已开工",
      body: `《${summary.title}》已进入 in_progress 状态，当前正在开发中。`,
      type: "system",
    });

    return "processed";
  },
  "developmentQueue.completed": async (payload) => {
    if (!(await requireModulesEnabled(["developmentQueue", "mailbox"]))) return "processed";

    const queueItemId = String(payload.queueItemId || "");
    if (!queueItemId) return "processed";

    const summary = await getDevelopmentQueueSummary(queueItemId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: "开发排期已完成",
      body: `《${summary.title}》已进入 completed 状态，可以准备发布或验收记录。`,
      type: "reward",
    });

    return "processed";
  },
  "developmentQueue.archived": async (payload) => {
    if (!(await requireModulesEnabled(["developmentQueue", "mailbox"]))) return "processed";

    const queueItemId = String(payload.queueItemId || "");
    if (!queueItemId) return "processed";

    const summary = await getDevelopmentQueueSummary(queueItemId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: "开发排期已归档",
      body: `《${summary.title}》已从开发排期中归档。`,
      type: "system",
    });

    return "processed";
  },
  "agentExecution.created": async (payload) => {
    if (!(await requireModulesEnabled(["agentExecution", "mailbox"]))) return "processed";

    const executionId = String(payload.executionId || "");
    if (!executionId) return "processed";

    const summary = await getAgentExecutionSummary(executionId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: "Agent 执行会话已创建",
      body: `执行会话《${summary.title}》已创建，当前状态为 queued。`,
      type: "system",
    });

    return "processed";
  },
  "agentExecution.started": async (payload) => {
    if (!(await requireModulesEnabled(["agentExecution", "mailbox"]))) return "processed";

    const executionId = String(payload.executionId || "");
    if (!executionId) return "processed";

    const summary = await getAgentExecutionSummary(executionId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: "Agent 执行已开始",
      body: `执行会话《${summary.title}》已进入 running 状态。`,
      type: "system",
    });

    return "processed";
  },
  "agentExecution.requeued": async (payload) => {
    if (!(await requireModulesEnabled(["agentExecution", "mailbox"]))) return "processed";

    const executionId = String(payload.executionId || "");
    if (!executionId) return "processed";

    const summary = await getAgentExecutionSummary(executionId);
    if (!summary) return "processed";
    const trigger = String(payload.trigger || "owner");

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: trigger === "recovery" ? "Agent 执行已自动恢复入队" : "Agent 执行已重入队",
      body:
        trigger === "recovery"
          ? `执行会话《${summary.title}》因长时间卡住运行态，已被平台自动恢复到 queued。`
          : `执行会话《${summary.title}》已重新进入 queued，等待 platform executor 再次处理。`,
      type: "system",
    });

    return "processed";
  },
  "agentExecution.artifactAdded": async (payload) => {
    if (!(await requireModulesEnabled(["agentExecution", "mailbox"]))) return "processed";

    const executionId = String(payload.executionId || "");
    if (!executionId) return "processed";

    const summary = await getAgentExecutionSummary(executionId);
    if (!summary) return "processed";

    const artifactTitle = String(payload.artifactTitle || "未命名成果物");
    const taskId = String(payload.taskId || "");

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: "Agent 成果物已记录",
      body: `执行会话《${summary.title}》新增成果物：${artifactTitle}。`,
      type: "system",
    });

    if (taskId) {
      const taskSummary = await getTaskSummary(taskId);
      if (taskSummary && taskSummary.creatorUserId !== summary.ownerUserId) {
        await insertMailboxMessage({
          userId: taskSummary.creatorUserId,
          title: "任务收到新的成果物",
          body: `关联任务 ${taskSummary.title} 的执行会话已上传成果物：${artifactTitle}。`,
          type: "system",
        });
      }
    }

    return "processed";
  },
  "arbitration.created": async (payload) => {
    if (!(await requireModulesEnabled(["arbitration", "mailbox"]))) return "processed";

    const caseId = String(payload.caseId || "");
    if (!caseId) return "processed";

    const summary = await getArbitrationCaseSummary(caseId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.requesterUserId,
      title: "仲裁案件已创建",
      body: `你的仲裁案件已创建，当前状态为 open。关联实体：${summary.entityType} ${summary.entityId}。`,
      type: "system",
    });

    await insertMailboxMessage({
      userId: summary.respondentUserId,
      title: "你收到一条仲裁案件",
      body: `有新的仲裁案件关联到 ${summary.entityType} ${summary.entityId}，当前状态为 open。`,
      type: "system",
    });
    return "processed";
  },
  "arbitration.evidenceAdded": async (payload) => {
    if (!(await requireModulesEnabled(["arbitration", "mailbox"]))) return "processed";

    const caseId = String(payload.caseId || "");
    const actorUserId = String(payload.actorUserId || "");
    const evidenceTitle = String(payload.title || "新增证据");
    if (!caseId) return "processed";

    const summary = await getArbitrationCaseSummary(caseId);
    if (!summary) return "processed";

    const recipients = [summary.requesterUserId, summary.respondentUserId].filter((userId) => userId && userId !== actorUserId);
    for (const userId of recipients) {
      await insertMailboxMessage({
        userId,
        title: "仲裁案件新增证据",
        body: `仲裁案件 ${caseId} 新增了证据：${evidenceTitle}。请及时查看。`,
        type: "system",
      });
    }

    return "processed";
  },
  "arbitration.reviewing": async (payload) => {
    if (!(await requireModulesEnabled(["arbitration", "mailbox"]))) return "processed";

    const caseId = String(payload.caseId || "");
    if (!caseId) return "processed";

    const summary = await getArbitrationCaseSummary(caseId);
    if (!summary) return "processed";

    for (const userId of [summary.requesterUserId, summary.respondentUserId]) {
      await insertMailboxMessage({
        userId,
        title: "仲裁案件进入审理",
        body: `仲裁案件 ${caseId} 当前已进入 under_review。`,
        type: "system",
      });
    }
    return "processed";
  },
  "arbitration.resolved": async (payload) => {
    if (!(await requireModulesEnabled(["arbitration", "mailbox"]))) return "processed";

    const caseId = String(payload.caseId || "");
    if (!caseId) return "processed";

    const summary = await getArbitrationCaseSummary(caseId);
    if (!summary) return "processed";

    for (const userId of [summary.requesterUserId, summary.respondentUserId]) {
      await insertMailboxMessage({
        userId,
        title: "仲裁案件已裁决",
        body: `仲裁案件 ${caseId} 已 resolved，请查看裁决摘要。`,
        type: "system",
      });
    }
    return "processed";
  },
  "arbitration.rejected": async (payload) => {
    if (!(await requireModulesEnabled(["arbitration", "mailbox"]))) return "processed";

    const caseId = String(payload.caseId || "");
    if (!caseId) return "processed";

    const summary = await getArbitrationCaseSummary(caseId);
    if (!summary) return "processed";

    for (const userId of [summary.requesterUserId, summary.respondentUserId]) {
      await insertMailboxMessage({
        userId,
        title: "仲裁案件已驳回",
        body: `仲裁案件 ${caseId} 已 rejected，请查看处理结果。`,
        type: "system",
      });
    }
    return "processed";
  },
  "agentExecution.submitted": async (payload) => {
    if (!(await requireModulesEnabled(["agentExecution", "mailbox"]))) return "processed";

    const executionId = String(payload.executionId || "");
    if (!executionId) return "processed";

    const summary = await getAgentExecutionSummary(executionId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: "Agent 已提交执行结果",
      body: `执行会话《${summary.title}》已进入 submitted 状态，请继续跟踪结果。`,
      type: "system",
    });

    return "processed";
  },
  "agentExecution.completed": async (payload) => {
    if (!(await requireModulesEnabled(["agentExecution", "mailbox"]))) return "processed";

    const executionId = String(payload.executionId || "");
    if (!executionId) return "processed";

    const summary = await getAgentExecutionSummary(executionId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: "Agent 执行已完成",
      body: `执行会话《${summary.title}》已完成。`,
      type: "reward",
    });

    return "processed";
  },
  "agentExecution.failed": async (payload) => {
    if (!(await requireModulesEnabled(["agentExecution", "mailbox"]))) return "processed";

    const executionId = String(payload.executionId || "");
    if (!executionId) return "processed";

    const summary = await getAgentExecutionSummary(executionId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: "Agent 执行失败",
      body: `执行会话《${summary.title}》已失败，请检查状态说明与结果摘要。`,
      type: "compensation",
    });

    return "processed";
  },
  "agentExecution.cancelled": async (payload) => {
    if (!(await requireModulesEnabled(["agentExecution", "mailbox"]))) return "processed";

    const executionId = String(payload.executionId || "");
    if (!executionId) return "processed";

    const summary = await getAgentExecutionSummary(executionId);
    if (!summary) return "processed";

    await insertMailboxMessage({
      userId: summary.ownerUserId,
      title: "Agent 执行已取消",
      body: `执行会话《${summary.title}》已取消。`,
      type: "system",
    });

    return "processed";
  },
  "agentExecution.callbackRemediationAlerted": async (payload) => {
    if (!(await requireModulesEnabled(["agentExecution", "mailbox"]))) return "processed";

    const alertLevel = Number(payload.alertLevel || 0);
    const detail = String(payload.detail || "").trim();
    const reasonCategory = String(payload.reasonCategory || "unknown");
    const reasonDisposition = String(payload.reasonDisposition || "unknown");
    const policyKey = String(payload.policyKey || "balanced");
    const callbackType = String(payload.scopeCallbackType || "").trim();
    const scopeAgentId = String(payload.scopeAgentId || "").trim();
    const count = Number(payload.count || 0);
    const agentOwnerUserId = String(payload.agentOwnerUserId || "").trim();
    const agentName = String(payload.agentName || "").trim();
    const operatorTitle =
      alertLevel >= 3 ? "Callback 自动补救需要紧急处理" : "Callback 自动补救进入 operator 队列";
    const subject = agentName ? `Agent《${agentName}》` : "当前 callback backlog";
    const callbackScope = callbackType ? ` / callbackType=${callbackType}` : "";
    const body = `${subject} 命中 callback remediation alert L${alertLevel}，原因=${reasonCategory}/${reasonDisposition}，policy=${policyKey}，影响数量=${count}${callbackScope}。${detail ? ` 摘要：${detail}` : ""}`;

    for (const operatorUserId of env.platformOperatorUserIds) {
      await insertMailboxMessage({
        userId: operatorUserId,
        title: operatorTitle,
        body,
        type: alertLevel >= 3 ? "compensation" : "system",
      });
    }

    if (agentOwnerUserId && !env.platformOperatorUserIds.includes(agentOwnerUserId)) {
      await insertMailboxMessage({
        userId: agentOwnerUserId,
        title: "你的 External Agent callback 需要关注",
        body: `你的 Agent${agentName ? `《${agentName}》` : ""}出现 callback remediation hotspot：L${alertLevel} / ${reasonCategory}/${reasonDisposition} / policy=${policyKey} / count=${count}。请前往 operator callback 面板查看。`,
        type: "system",
      });
    }

    return "processed";
  },
  "agentExecution.runtimePressureAlerted": async (payload) => {
    if (!(await requireModulesEnabled(["agentExecution", "mailbox"]))) return "processed";

    const alertLevel = Number(payload.alertLevel || 0);
    const profileKey = String(payload.profileKey || "baseline").trim();
    const pressureLevel = String(payload.pressureLevel || "watch").trim();
    const schedulingDecisionClass = String(payload.schedulingDecisionClass || "within_capacity").trim();
    const detail = String(payload.detail || "").trim();
    const queuedExecutionCount = Number(payload.queuedExecutionCount || 0);
    const runningExecutionCount = Number(payload.runningExecutionCount || 0);
    const ownerUserId = String(payload.ownerUserId || "").trim();
    const operatorTitle =
      alertLevel >= 3 ? "Runtime pressure 需要紧急处理" : "Runtime pressure 进入观察态";
    const body =
      `Runtime profile ${profileKey} 命中 L${alertLevel} pressure alert，pressure=${pressureLevel}，` +
      `decision=${schedulingDecisionClass}，running=${runningExecutionCount}，queued=${queuedExecutionCount}。` +
      `${detail ? ` ${detail}` : ""}`;

    for (const operatorUserId of env.platformOperatorUserIds) {
      await insertMailboxMessage({
        userId: operatorUserId,
        title: operatorTitle,
        body,
        type: alertLevel >= 3 ? "compensation" : "system",
      });
    }

    if (ownerUserId && !env.platformOperatorUserIds.includes(ownerUserId)) {
      await insertMailboxMessage({
        userId: ownerUserId,
        title: "你的 runtime profile 需要关注",
        body: `你在 runtime profile ${profileKey} 上出现并发压力：L${alertLevel} / ${schedulingDecisionClass} / queued=${queuedExecutionCount}。请前往 operator callback 面板查看 runtime pressure。`,
        type: "system",
      });
    }

    return "processed";
  },
  "outbox.alerted": async (payload) => {
    if (!(await requireModulesEnabled(["mailbox"]))) return "processed";

    const alertLevel = Number(payload.alertLevel || 0);
    const title = String(payload.title || "Outbox 队列需要处理").trim();
    const detail = String(payload.detail || "").trim();
    const kind = String(payload.kind || "unknown");
    const queueStatus = String(payload.queueStatus || "unknown");
    const count = Number(payload.count || 0);
    const operatorTitle =
      alertLevel >= 3 ? "Outbox 队列触发高优先级告警" : "Outbox 队列进入观察态";
    const body = `${title}，kind=${kind}，queue=${queueStatus}，count=${count}。${detail}`;

    for (const operatorUserId of env.platformOperatorUserIds) {
      await insertMailboxMessage({
        userId: operatorUserId,
        title: operatorTitle,
        body,
        type: alertLevel >= 3 ? "compensation" : "system",
      });
    }

    return "processed";
  },
  "wallet.changed": noopHandler,
  "wallet.exchanged": async (payload) => {
    if (!(await requireModulesEnabled(["wallet", "ledger", "mailbox"]))) return "processed";

    const userId = String(payload.userId || "");
    const obsidian = Number(payload.obsidian || 0);
    const mira = Number(payload.mira || 0);
    if (!userId || !Number.isFinite(obsidian) || !Number.isFinite(mira)) return "processed";

    await insertMailboxMessage({
      userId,
      title: "曜石兑换完成",
      body: `你已完成一次单向兑换：${obsidian} 曜石 -> ${mira} 米拉。该记录已写入账本。`,
      type: "system",
    });

    return "processed";
  },
  "product.purchased": async (payload) => {
    if (!(await requireModulesEnabled(["product", "mailbox"]))) return "processed";

    let userId = String(payload.userId || "");
    let productTitle = String(payload.productTitle || "");

    if (!userId && payload.orderId) {
      const summary = await getOrderPurchaseSummary(String(payload.orderId));
      if (summary) {
        userId = summary.userId;
        productTitle = productTitle || summary.productTitle;
      }
    }

    if (!userId) return "processed";

    await insertMailboxMessage({
      userId,
      title: "商品购买成功",
      body: `你已成功购买商品${productTitle ? `：${productTitle}` : ""}。相关资产已按订单发放。`,
      type: "system",
    });

    return "processed";
  },
  "product.updated": noopHandler,
  "product.deactivated": noopHandler,
  "product.deleted": noopHandler,
  "product.orderRolledBack": noopHandler,
  "item.granted": noopHandler,
  "item.issueReported": async (payload) => {
    if (!(await requireModulesEnabled(["item", "mailbox"]))) return "processed";

    const itemId = String(payload.itemId || "");
    const userId = String(payload.userId || "");
    if (!itemId || !userId) return "processed";

    const itemSummary = await getItemSummary(itemId);
    const unitSummary = payload.unitId ? await getItemUnitSummary(String(payload.unitId)) : null;
    const reason = String(payload.reason || unitSummary?.issueReason || "unknown");
    const replacementTriggered = Boolean(payload.replacementTriggered);
    const rejectionCode = String(payload.rejectionCode || "");

    await insertMailboxMessage({
      userId,
      title: "资产单元问题已记录",
      body: replacementTriggered
        ? `你的资产${itemSummary?.productTitle ? `《${itemSummary.productTitle}》` : ""}已记录问题单元 ${unitSummary?.code ?? ""}（原因：${reason}），系统正在按履约规则补位/补号。`
        : `你的资产${itemSummary?.productTitle ? `《${itemSummary.productTitle}》` : ""}已记录问题单元 ${unitSummary?.code ?? ""}（原因：${reason}），本次未触发自动补位。${rejectionCode ? ` 拒绝原因：${rejectionCode}。` : ""}`,
      type: replacementTriggered ? "system" : "compensation",
    });

    return "processed";
  },
  "item.manualReviewRequested": async (payload) => {
    if (!(await requireModulesEnabled(["item", "mailbox"]))) return "processed";

    const itemId = String(payload.itemId || "");
    const userId = String(payload.userId || "");
    if (!itemId || !userId) return "processed";

    const itemSummary = await getItemSummary(itemId);
    const reason = String(payload.reason || "unknown");
    const routingSummary = String(payload.routingSummary || "").trim();
    const suggestedAction = String(payload.suggestedAction || "").trim();

    await insertMailboxMessage({
      userId,
      title: "资产已进入人工复核",
      body: `你的资产${itemSummary?.productTitle ? `《${itemSummary.productTitle}》` : ""}因 ${reason} 已进入人工复核队列，平台将进一步判断是否补位/补号。${routingSummary ? ` 复核摘要：${routingSummary}` : ""}${suggestedAction ? ` 建议动作：${suggestedAction}` : ""}`,
      type: "compensation",
    });

    return "processed";
  },
  "item.manualReviewResolved": async (payload) => {
    if (!(await requireModulesEnabled(["item", "mailbox"]))) return "processed";

    const itemId = String(payload.itemId || "");
    const userId = String(payload.userId || "");
    if (!itemId || !userId) return "processed";

    const itemSummary = await getItemSummary(itemId);
    const action = String(payload.action || "");
    const resolutionNote = String(payload.resolutionNote || "").trim();

    await insertMailboxMessage({
      userId,
      title: "资产人工复核已处理",
      body:
        action === "approve_replacement"
          ? `你的资产${itemSummary?.productTitle ? `《${itemSummary.productTitle}》` : ""}已通过人工复核，平台已补位/补号。${resolutionNote ? ` 处理说明：${resolutionNote}` : ""}`
          : `你的资产${itemSummary?.productTitle ? `《${itemSummary.productTitle}》` : ""}人工复核已完成，本次未触发补位/补号。${resolutionNote ? ` 处理说明：${resolutionNote}` : ""}`,
      type: action === "approve_replacement" ? "reward" : "system",
    });

    return "processed";
  },
  "item.manualReviewReleased": async () => {
    return "processed";
  },
  "item.replaced": async (payload) => {
    if (!(await requireModulesEnabled(["item", "mailbox"]))) return "processed";

    const itemId = String(payload.itemId || "");
    const userId = String(payload.userId || "");
    const newUnitId = String(payload.newUnitId || "");
    if (!itemId || !userId || !newUnitId) return "processed";

    const itemSummary = await getItemSummary(itemId);
    const newUnitSummary = await getItemUnitSummary(newUnitId);

    await insertMailboxMessage({
      userId,
      title: "资产单元已完成补位",
      body: `你的资产${itemSummary?.productTitle ? `《${itemSummary.productTitle}》` : ""}已完成补位/补号，新单元编号为 ${newUnitSummary?.code ?? "未知"}。当前累计补换次数：${itemSummary?.replacementCount ?? 0}。`,
      type: "reward",
    });

    return "processed";
  },
  "item.reconciled": async (payload) => {
    if (!(await requireModulesEnabled(["item", "mailbox"]))) return "processed";

    const itemId = String(payload.itemId || "");
    const userId = String(payload.userId || "");
    if (!itemId || !userId) return "processed";

    const itemSummary = await getItemSummary(itemId);
    const replacementsCreated = Number(payload.replacementsCreated || 0);

    await insertMailboxMessage({
      userId,
      title: "资产履约已对账",
      body: `你的资产${itemSummary?.productTitle ? `《${itemSummary.productTitle}》` : ""}已完成一次履约对账。本次补位/补号数量：${replacementsCreated}。`,
      type: "system",
    });

    return "processed";
  },
  "item.anomalyEscalated": async (payload) => {
    if (!(await requireModulesEnabled(["item", "mailbox"]))) return "processed";

    const itemId = String(payload.itemId || "");
    if (!itemId) return "processed";

    const itemSummary = await getItemSummary(itemId);
    if (!itemSummary) return "processed";

    const alertLevel = Number(payload.alertLevel || 0);
    const kind = String(payload.kind || "unknown");
    const lastAlertReason = String(payload.lastAlertReason || "").trim();
    const escalationStrategy = String(payload.escalationStrategy || "").trim();

    await insertMailboxMessage({
      userId: itemSummary.userId,
      title: "资产履约异常已升级",
      body: `你的资产${itemSummary.productTitle ? `《${itemSummary.productTitle}》` : ""}出现 ${kind} 异常，当前告警等级为 ${alertLevel}。${lastAlertReason ? ` 处理摘要：${lastAlertReason}` : "平台已将该问题升级到履约异常队列。"}`,
      type: "system",
    });

    if (escalationStrategy === "operator_review" || escalationStrategy === "urgent_operator_review") {
      const operatorTitle = escalationStrategy === "urgent_operator_review" ? "履约异常需要紧急处理" : "履约异常进入 operator 队列";
      const operatorBody = `资产${itemSummary.productTitle ? `《${itemSummary.productTitle}》` : ""}触发 ${kind} 异常，当前告警等级为 ${alertLevel}。${lastAlertReason ? ` 处理摘要：${lastAlertReason}` : ""}`;
      const recipients = env.platformOperatorUserIds.filter((userId: string) => userId !== itemSummary.userId);
      for (const operatorUserId of recipients) {
        await insertMailboxMessage({
          userId: operatorUserId,
          title: operatorTitle,
          body: operatorBody,
          type: escalationStrategy === "urgent_operator_review" ? "compensation" : "system",
        });
      }
    }

    return "processed";
  },
  "item.anomalyAutoActionApplied": async (payload) => {
    if (!(await requireModulesEnabled(["item", "mailbox"]))) return "processed";

    const itemId = String(payload.itemId || "");
    if (!itemId) return "processed";

    const itemSummary = await getItemSummary(itemId);
    if (!itemSummary) return "processed";

    const action = String(payload.autoAction || "none");
    const status = String(payload.autoActionStatus || "noop");
    const result = String(payload.autoActionResult || action);
    const error = String(payload.autoActionError || "").trim();
    const body =
      status === "applied"
        ? `你的资产${itemSummary.productTitle ? `《${itemSummary.productTitle}》` : ""}触发了自动治理动作 ${action}，结果为 ${result}。`
        : status === "failed"
          ? `你的资产${itemSummary.productTitle ? `《${itemSummary.productTitle}》` : ""}尝试执行自动治理动作 ${action} 失败。${error ? ` 错误：${error}` : ""}`
          : `你的资产${itemSummary.productTitle ? `《${itemSummary.productTitle}》` : ""}完成了一次自动治理评估，动作 ${action} 本轮未产生队列变更。`;

    await insertMailboxMessage({
      userId: itemSummary.userId,
      title: status === "failed" ? "资产自动治理失败" : "资产自动治理已执行",
      body,
      type: status === "failed" ? "system" : "reward",
    });

    if (status === "failed") {
      for (const operatorUserId of env.platformOperatorUserIds.filter((userId: string) => userId !== itemSummary.userId)) {
        await insertMailboxMessage({
          userId: operatorUserId,
          title: "资产自动治理需要人工介入",
          body: `资产${itemSummary.productTitle ? `《${itemSummary.productTitle}》` : ""}的自动治理动作 ${action} 执行失败。${error ? ` 错误：${error}` : ""}`,
          type: "system",
        });
      }
    }

    return "processed";
  },
  "redemption.used": async (payload) => {
    if (!(await requireModulesEnabled(["redemption", "mailbox"]))) return "processed";

    const userId = String(payload.userId || "");
    if (!userId) return "processed";

    const redemptionCodeId = String(payload.redemptionCodeId || "");
    const code = redemptionCodeId ? await getRedemptionCode(redemptionCodeId) : null;
    const customTitle = typeof payload.mailTitle === "string" && payload.mailTitle ? payload.mailTitle : null;
    const customBody = typeof payload.mailBody === "string" && payload.mailBody ? payload.mailBody : null;

    await insertMailboxMessage({
      userId,
      title: customTitle || "兑换成功",
      body: customBody || (code
        ? `你已成功使用兑换码 ${code}，奖励已发放到账号。`
        : "你已成功使用兑换码，奖励已发放到账号。"),
      type: "reward",
    });

    return "processed";
  },
  "mail.sent": noopHandler,
  "mail.claimed": noopHandler,
  "task.created": noopHandler,
  "task.applied": noopHandler,
  "task.assigned": async (payload) => {
    if (!(await requireModulesEnabled(["taskHub", "mailbox"]))) return "processed";
    const assignedUserId = String(payload.assignedUserId || "");
    const taskId = String(payload.taskId || "");
    if (!assignedUserId || !taskId) return "processed";
    await insertMailboxMessage({
      userId: assignedUserId,
      title: "你已被分配任务",
      body: `任务 ${taskId} 已自动分配给你，请尽快进入任务面板查看详情。`,
      type: "system",
    });
    return "processed";
  },
  "task.started": async (payload) => {
    if (!(await requireModulesEnabled(["taskHub", "mailbox"]))) return "processed";

    const taskId = String(payload.taskId || "");
    if (!taskId) return "processed";

    const taskSummary = await getTaskSummary(taskId);
    if (!taskSummary) return "processed";

    await insertMailboxMessage({
      userId: taskSummary.creatorUserId,
      title: "任务已开始执行",
      body: `任务 ${taskSummary.title} 已由承接者开始执行。`,
      type: "system",
    });
    return "processed";
  },
  "task.submitted": async (payload) => {
    if (!(await requireModulesEnabled(["taskHub", "mailbox"]))) return "processed";

    const taskId = String(payload.taskId || "");
    if (!taskId) return "processed";

    const taskSummary = await getTaskSummary(taskId);
    if (!taskSummary) return "processed";

    await insertMailboxMessage({
      userId: taskSummary.creatorUserId,
      title: "任务已提交验收",
      body: `任务 ${taskSummary.title} 已提交，请及时验收或标记违约。`,
      type: "system",
    });

    return "processed";
  },
  "task.accepted": async (payload) => {
    if (!(await requireModulesEnabled(["taskHub", "mailbox"]))) return "processed";

    const taskId = String(payload.taskId || "");
    if (!taskId) return "processed";

    const taskSummary = await getTaskSummary(taskId);
    if (!taskSummary || !taskSummary.assignedUserId) return "processed";

    await insertMailboxMessage({
      userId: taskSummary.assignedUserId,
      title: "任务验收通过",
      body: `任务 ${taskSummary.title} 已验收通过，奖励结算已完成。`,
      type: "reward",
    });

    await insertMailboxMessage({
      userId: taskSummary.creatorUserId,
      title: "任务已完成",
      body: `你发布的任务 ${taskSummary.title} 已完成并结算。`,
      type: "system",
    });

    return "processed";
  },
  "task.defaulted": async (payload) => {
    if (!(await requireModulesEnabled(["taskHub", "mailbox"]))) return "processed";

    const taskId = String(payload.taskId || "");
    if (!taskId) return "processed";

    const taskSummary = await getTaskSummary(taskId);
    if (!taskSummary || !taskSummary.assignedUserId) return "processed";

    await insertMailboxMessage({
      userId: taskSummary.assignedUserId,
      title: "任务已判定违约",
      body: `任务 ${taskSummary.title} 已判定为违约，请查看任务详情与信誉变更。`,
      type: "compensation",
    });

    await insertMailboxMessage({
      userId: taskSummary.creatorUserId,
      title: "任务违约已处理",
      body: `你发布的任务 ${taskSummary.title} 已按违约流程处理。`,
      type: "system",
    });

    return "processed";
  },
  "task.cancelled": async (payload) => {
    if (!(await requireModulesEnabled(["taskHub", "mailbox"]))) return "processed";

    const taskId = String(payload.taskId || "");
    if (!taskId) return "processed";

    const taskSummary = await getTaskSummary(taskId);
    if (!taskSummary) return "processed";

    await insertMailboxMessage({
      userId: taskSummary.creatorUserId,
      title: "任务已取消",
      body: `任务 ${taskSummary.title} 已取消，托管奖励和保证金已按规则处理。`,
      type: "system",
    });

    if (taskSummary.assignedUserId) {
      await insertMailboxMessage({
        userId: taskSummary.assignedUserId,
        title: "任务已取消",
        body: `任务 ${taskSummary.title} 已被发布者取消，请查看你的保证金和相关状态变更。`,
        type: "system",
      });
    }

    return "processed";
  },
  "reputation.updated": noopHandler,
  "aiGateway.anomalyIncidentAlerted": noopHandler,
  "aiGateway.remediationEffectivenessAnomalyAlerted": noopHandler,
  "aiGateway.rateLimitHotspotAnomalyAlerted": noopHandler,
};

export async function handleEvent(eventName: EventName, payload: Record<string, unknown>) {
  const handler = handlers[eventName];
  if (!handler) return "processed";
  return handler(payload);
}
