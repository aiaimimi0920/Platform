"use server";

import {
  opinionTopicTagKeys,
  type CreateOpinionTopicInput,
} from "@neuro/contracts";

import { redirect } from "next/navigation";

import {
  adoptOpinionTopic,
  archiveOpinionTopic,
  createOpinionTopic,
  createOpinionTopicComment,
  getOpinionMonthlySettlementRunDetailInternal,
  moderateOpinionTopicInternal,
  opposeOpinionTopic,
  runOpinionMonthlyLeaderSettlementInternal,
  supportOpinionTopic,
  updateOpinionHubSettingsInternal,
  updateOpinionMonthlySettlementItemDecisionInternal,
} from "@/lib/platform-client";
import { requirePlatformOperatorUserContext, requirePlatformUserContext } from "@/lib/platform-session";
import {
  appendQueryParams,
  buildStatusRedirect,
  resolveRedirectPath,
  toMessage,
} from "@/lib/platform-action-utils";

function buildOpinionSettlementBatchDiff(
  beforeDetail: Awaited<ReturnType<typeof getOpinionMonthlySettlementRunDetailInternal>>,
  afterDetail: Awaited<ReturnType<typeof updateOpinionMonthlySettlementItemDecisionInternal>>,
  operatedItemIds: string[],
) {
  const beforeSelectedIds = new Set(
    beforeDetail.items.filter((item) => item.selectionStatus === "selected").map((item) => item.id),
  );
  const afterSelectedIds = new Set(
    afterDetail.items.filter((item) => item.selectionStatus === "selected").map((item) => item.id),
  );
  const finalItemIdSet = new Set(afterDetail.items.map((item) => item.id));
  const uniqueOperatedItemIds = Array.from(new Set(operatedItemIds)).filter((itemId) => finalItemIdSet.has(itemId));
  const newSelectedItemIds = afterDetail.items
    .filter((item) => afterSelectedIds.has(item.id) && !beforeSelectedIds.has(item.id))
    .map((item) => item.id);
  const droppedSelectedItemIds = beforeDetail.items
    .filter((item) => beforeSelectedIds.has(item.id) && !afterSelectedIds.has(item.id))
    .map((item) => item.id);
  return {
    droppedSelectedItemIds,
    newSelectedItemIds,
    operatedItemIds: uniqueOperatedItemIds,
  };
}

export async function createOpinionTopicAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/opinions");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const tag = String(formData.get("tag") || "").trim();

  if (title.length < 4) {
    redirect(buildStatusRedirect(redirectTo, "error", "议题标题至少需要 4 个字。"));
  }
  if (description.length < 16) {
    redirect(buildStatusRedirect(redirectTo, "error", "详细描述至少需要 16 个字。"));
  }
  if (!opinionTopicTagKeys.includes(tag as CreateOpinionTopicInput["tag"])) {
    redirect(buildStatusRedirect(redirectTo, "error", "请选择 1 个标签。"));
  }

  try {
    const topic = await createOpinionTopic(userContext, {
      title,
      description,
      tag: tag as CreateOpinionTopicInput["tag"],
    });
    const message =
      topic.reviewStatus === "pending_review"
        ? "议题已提交，因审核规则进入待审队列。"
        : "议题创建成功。";
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    const message = toMessage(error, "议题创建失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function supportOpinionTopicAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/opinions");
  const topicId = String(formData.get("topicId") || "");
  const ticketAmount = 1;
  if (!topicId || !ticketAmount) {
    redirect(buildStatusRedirect(redirectTo, "error", "支持参数无效。"));
  }

  try {
    await supportOpinionTopic(userContext, topicId, ticketAmount);
    redirect(buildStatusRedirect(redirectTo, "success", "支持已提交。"));
  } catch (error) {
    const message = toMessage(error, "支持议题失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function opposeOpinionTopicAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/opinions");
  const topicId = String(formData.get("topicId") || "");
  const ticketAmount = 1;
  if (!topicId || !ticketAmount) {
    redirect(buildStatusRedirect(redirectTo, "error", "反对参数无效。"));
  }

  try {
    await opposeOpinionTopic(userContext, topicId, ticketAmount);
    redirect(buildStatusRedirect(redirectTo, "success", "反对已提交。"));
  } catch (error) {
    const message = toMessage(error, "反对议题失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function archiveOpinionTopicAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/opinions");
  const topicId = String(formData.get("topicId") || "");
  if (!topicId) {
    redirect(buildStatusRedirect(redirectTo, "error", "议题参数无效。"));
  }

  try {
    await archiveOpinionTopic(userContext, topicId);
    redirect(buildStatusRedirect(redirectTo, "success", "议题已归档。"));
  } catch (error) {
    const message = toMessage(error, "议题归档失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function adoptOpinionTopicAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/opinions");
  const topicId = String(formData.get("topicId") || "");
  if (!topicId) {
    redirect(buildStatusRedirect(redirectTo, "error", "议题参数无效。"));
  }

  try {
    await adoptOpinionTopic(userContext, topicId);
    redirect(buildStatusRedirect(redirectTo, "success", "议题已采纳。"));
  } catch (error) {
    const message = toMessage(error, "议题采纳失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function createOpinionTopicCommentAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/opinions");
  const topicId = String(formData.get("topicId") || "");
  const content = String(formData.get("content") || "");
  const replyToCommentId = String(formData.get("replyToCommentId") || "").trim();
  if (!topicId || !content.trim()) {
    redirect(buildStatusRedirect(redirectTo, "error", "讨论内容不能为空。"));
  }

  try {
    await createOpinionTopicComment(userContext, topicId, {
      content,
      replyToCommentId: replyToCommentId || null,
    });
    redirect(buildStatusRedirect(redirectTo, "success", "讨论回复已发送。"));
  } catch (error) {
    const message = toMessage(error, "讨论回复失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function updateOpinionHubSettingsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/issues");

  try {
    await updateOpinionHubSettingsInternal(userContext, {
      preModerationEnabled: String(formData.get("preModerationEnabled") || "") === "on",
    });
    redirect(buildStatusRedirect(redirectTo, "success", "议题审核开关已更新。"));
  } catch (error) {
    const message = toMessage(error, "议题审核开关更新失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function moderateOpinionTopicAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/issues");
  const topicId = String(formData.get("topicId") || "");
  const action = String(formData.get("action") || "");
  const note = String(formData.get("note") || "").trim();

  if (!topicId || !action) {
    redirect(buildStatusRedirect(redirectTo, "error", "议题管理参数无效。"));
  }

  try {
    await moderateOpinionTopicInternal(userContext, topicId, {
      action: action as
        | "approve"
        | "reject"
        | "ban"
        | "stopDiscussion"
        | "resumeDiscussion"
        | "delete",
      note: note || null,
    });
    redirect(buildStatusRedirect(redirectTo, "success", "议题管理操作已提交。"));
  } catch (error) {
    const message = toMessage(error, "议题管理操作失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function runOpinionMonthlyLeaderSettlementAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/issues");
  const rawLimit = Number(formData.get("limit") || 10);
  const limit = Math.max(5, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 10));

  try {
    const result = await runOpinionMonthlyLeaderSettlementInternal(userContext, limit);
    const message = result.skipped
      ? `上月候补池结算已跳过：${result.monthKey} 已存在结算记录，当前候补池 ${result.settledCount} 条。`
      : `上月候补池结算已执行：${result.monthKey} 纳入候补池 ${result.settledCount} 条，当前入选推入开发排期 ${result.queuedCount} 条。`;
    redirect(
      appendQueryParams(buildStatusRedirect(redirectTo, "success", message), {
        settlementMonth: result.monthKey,
        settlementSettledCount: String(result.settledCount),
        settlementQueuedCount: String(result.queuedCount),
        settlementSkipped: result.skipped ? "1" : "0",
        roadmapItemIds: result.queueItemIds.join(","),
      }),
    );
  } catch (error) {
    const message = toMessage(error, "执行议题月度结算失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function updateOpinionMonthlySettlementItemDecisionAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/issues");
  const monthKey = String(formData.get("monthKey") || "").trim();
  const itemId = String(formData.get("itemId") || "").trim();
  const action = String(formData.get("action") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!monthKey || !itemId || !["exclude", "restore"].includes(action)) {
    redirect(buildStatusRedirect(redirectTo, "error", "候补池条目参数无效。"));
  }

  try {
    const detail = await updateOpinionMonthlySettlementItemDecisionInternal(userContext, monthKey, itemId, {
      action: action as "exclude" | "restore",
      note: note || null,
    });

    const roadmapItemIds = detail.items
      .filter((item) => item.selectionStatus === "selected")
      .map((item) => item.queueItemId)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    const message =
      action === "exclude"
        ? `已更新 ${monthKey} 候补池：当前入选 ${detail.run.selectedCount}/${detail.run.selectionLimit}。`
        : `已恢复 ${monthKey} 候补池条目，系统已按候补顺位重新收口前 ${detail.run.selectionLimit}。`;

    redirect(
      appendQueryParams(buildStatusRedirect(redirectTo, "success", message), {
        settlementMonth: monthKey,
        roadmapItemIds: roadmapItemIds.join(","),
      }),
    );
  } catch (error) {
    const message = toMessage(error, "更新候补池条目失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function batchExcludeOpinionMonthlySettlementItemsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/issues");
  const monthKey = String(formData.get("monthKey") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const itemIds = Array.from(
    new Set(
      formData
        .getAll("itemIds")
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0),
    ),
  );

  if (!monthKey || itemIds.length === 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "\u5f53\u524d\u5207\u7247\u6ca1\u6709\u53ef\u6279\u91cf\u6392\u9664\u7684\u5019\u8865\u6c60\u6761\u76ee\u3002"));
  }

  if (itemIds.length > 20) {
    redirect(buildStatusRedirect(redirectTo, "error", "\u5355\u6b21\u6279\u91cf\u6392\u9664\u7684\u6761\u76ee\u6570\u4e0d\u80fd\u8d85\u8fc7 20 \u6761\u3002"));
  }

  try {
    const beforeDetail = await getOpinionMonthlySettlementRunDetailInternal(userContext, monthKey);
    let detail: Awaited<ReturnType<typeof updateOpinionMonthlySettlementItemDecisionInternal>> | null = null;
    for (const itemId of itemIds) {
      detail = await updateOpinionMonthlySettlementItemDecisionInternal(userContext, monthKey, itemId, {
        action: "exclude",
        note: note || null,
      });
    }

    if (!detail) {
      redirect(buildStatusRedirect(redirectTo, "error", "\u5f53\u524d\u5207\u7247\u6ca1\u6709\u53ef\u6279\u91cf\u6392\u9664\u7684\u5019\u8865\u6c60\u6761\u76ee\u3002"));
    }

    const roadmapItemIds = detail.items
      .filter((item) => item.selectionStatus === "selected")
      .map((item) => item.queueItemId)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    const standbyCount = detail.items.filter((item) => item.selectionStatus === "standby").length;
    const excludedCount = detail.items.filter((item) => item.selectionStatus === "excluded").length;
    const batchDiff = buildOpinionSettlementBatchDiff(beforeDetail, detail, itemIds);

    redirect(
      appendQueryParams(
        buildStatusRedirect(
          redirectTo,
          "success",
          `\u5df2\u6309\u7edf\u4e00\u539f\u56e0\u6279\u91cf\u6392\u9664 ${itemIds.length} \u6761\u5019\u8865\u6c60\u6761\u76ee\uff0c\u5f53\u524d\u5165\u9009 ${detail.run.selectedCount}/${detail.run.selectionLimit}\u3002`,
        ),
        {
          settlementMonth: monthKey,
          roadmapItemIds: roadmapItemIds.join(","),
          batchAction: "exclude",
          batchAffectedCount: String(itemIds.length),
          batchSelectedCount: String(detail.run.selectedCount),
          batchStandbyCount: String(standbyCount),
          batchExcludedCount: String(excludedCount),
          batchOperatedItemIds: batchDiff.operatedItemIds.join(","),
          batchNewSelectedItemIds: batchDiff.newSelectedItemIds.join(","),
          batchDroppedSelectedItemIds: batchDiff.droppedSelectedItemIds.join(","),
        },
      ),
    );
  } catch (error) {
    const message = toMessage(error, "\u6279\u91cf\u6392\u9664\u5019\u8865\u6c60\u6761\u76ee\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function batchRestoreOpinionMonthlySettlementItemsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/issues");
  const monthKey = String(formData.get("monthKey") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const itemIds = Array.from(
    new Set(
      formData
        .getAll("itemIds")
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0),
    ),
  );

  if (!monthKey || itemIds.length === 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "当前切片没有可批量恢复的候补池条目。"));
  }

  if (itemIds.length > 20) {
    redirect(buildStatusRedirect(redirectTo, "error", "单次批量恢复的条目数不能超过 20 条。"));
  }

  try {
    const beforeDetail = await getOpinionMonthlySettlementRunDetailInternal(userContext, monthKey);
    let detail: Awaited<ReturnType<typeof updateOpinionMonthlySettlementItemDecisionInternal>> | null = null;
    for (const itemId of itemIds) {
      detail = await updateOpinionMonthlySettlementItemDecisionInternal(userContext, monthKey, itemId, {
        action: "restore",
        note: note || null,
      });
    }

    if (!detail) {
      redirect(buildStatusRedirect(redirectTo, "error", "当前切片没有可批量恢复的候补池条目。"));
    }

    const roadmapItemIds = detail.items
      .filter((item) => item.selectionStatus === "selected")
      .map((item) => item.queueItemId)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    const standbyCount = detail.items.filter((item) => item.selectionStatus === "standby").length;
    const excludedCount = detail.items.filter((item) => item.selectionStatus === "excluded").length;
    const batchDiff = buildOpinionSettlementBatchDiff(beforeDetail, detail, itemIds);

    redirect(
      appendQueryParams(
        buildStatusRedirect(
          redirectTo,
          "success",
          `已批量恢复 ${itemIds.length} 条候补池条目，系统已按候补顺位重新收口前 ${detail.run.selectionLimit}。`,
        ),
        {
          settlementMonth: monthKey,
          roadmapItemIds: roadmapItemIds.join(","),
          batchAction: "restore",
          batchAffectedCount: String(itemIds.length),
          batchSelectedCount: String(detail.run.selectedCount),
          batchStandbyCount: String(standbyCount),
          batchExcludedCount: String(excludedCount),
          batchOperatedItemIds: batchDiff.operatedItemIds.join(","),
          batchNewSelectedItemIds: batchDiff.newSelectedItemIds.join(","),
          batchDroppedSelectedItemIds: batchDiff.droppedSelectedItemIds.join(","),
        },
      ),
    );
  } catch (error) {
    const message = toMessage(error, "批量恢复候补池条目失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}
