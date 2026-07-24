export function formatOwnerSafeArbitrationActor(
  userId: string,
  args: {
    currentUserId: string;
    requesterUserId: string;
    respondentUserId: string;
  },
) {
  if (userId === args.currentUserId) return "当前用户";
  if (userId === args.requesterUserId) return "申请人";
  if (userId === args.respondentUserId) return "被申请人";
  return "仲裁处理方";
}

export function formatArbitrationTimelineKind(value: string) {
  switch (value) {
    case "created":
      return "案件创建";
    case "evidence":
      return "证据补充";
    case "under_review":
      return "进入审理";
    case "resolved":
      return "案件裁决";
    case "rejected":
      return "案件驳回";
    case "effects_applied":
      return "裁决生效";
    default:
      return "案件进展";
  }
}

export function formatOwnerSafeArbitrationTimelineTitle(kind: string) {
  switch (kind) {
    case "created":
      return "案件已创建";
    case "evidence":
      return "证据已补充";
    case "under_review":
      return "案件进入审理";
    case "resolved":
      return "案件已裁决";
    case "rejected":
      return "案件已驳回";
    case "effects_applied":
      return "裁决结果已生效";
    default:
      return "案件状态已更新";
  }
}
