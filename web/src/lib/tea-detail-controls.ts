export type TeaDetailLifecycleAction =
  | "decompose"
  | "analyze"
  | "plan"
  | "approve"
  | "run"
  | "stop"
  | "retry"
  | "accept"
  | "close"
  | "cancel";

export type TeaDetailLifecycleControl = {
  action: TeaDetailLifecycleAction;
  label: string;
  requiresRun?: boolean;
  variant?: string;
};

export type TeaDetailDownloadLink = {
  href: string;
  label: string;
};

export type TeaTicketDetailControls = {
  canMutate: boolean;
  downloadLinks: TeaDetailDownloadLink[];
  lifecycleControls: TeaDetailLifecycleControl[];
  showCommentForm: boolean;
  showRejectForm: boolean;
};

const terminalStatuses = new Set(["closed", "cancelled"]);

const lifecycleControls: TeaDetailLifecycleControl[] = [
  { action: "decompose", label: "拆解工单", variant: "mg-btn--primary" },
  { action: "analyze", label: "AI 分析" },
  { action: "plan", label: "生成计划" },
  { action: "approve", label: "审批", variant: "mg-btn--secondary" },
  { action: "run", label: "执行", variant: "mg-btn--primary" },
  { action: "stop", label: "停止最新执行", requiresRun: true, variant: "mg-btn--glass" },
  { action: "retry", label: "重试最新执行", requiresRun: true, variant: "mg-btn--glass" },
  { action: "accept", label: "验收" },
  { action: "close", label: "关闭" },
  { action: "cancel", label: "取消", variant: "mg-btn--glass" },
];

export function isTerminalTeaTicketStatus(status: string): boolean {
  return terminalStatuses.has(status);
}

export function getTeaTicketDetailControls(ticketId: string, status: string): TeaTicketDetailControls {
  const encodedTicketId = encodeURIComponent(ticketId);
  const canMutate = !isTerminalTeaTicketStatus(status);

  return {
    canMutate,
    downloadLinks: [
      {
        href: `/api/tea/tickets/${encodedTicketId}/export/json/download`,
        label: "下载 JSON",
      },
      {
        href: `/api/tea/tickets/${encodedTicketId}/export/markdown/download`,
        label: "下载 Markdown",
      },
    ],
    lifecycleControls: canMutate ? lifecycleControls : [],
    showCommentForm: canMutate,
    showRejectForm: canMutate,
  };
}
