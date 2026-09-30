export function gatewayConversationArchiveStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "partial":
      return "部分完成";
    case "archive_failed":
      return "归档失败";
    default:
      return status;
  }
}

export function gatewayCredentialModelStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "正常";
    case "degraded":
      return "降级";
    case "cooling":
      return "冷却中";
    case "blocked":
      return "已阻断";
    default:
      return status;
  }
}
