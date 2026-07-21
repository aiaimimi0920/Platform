import type { TaskStatus, TaskView } from "@neuro/contracts";

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: "草稿",
  open: "开放中",
  applying: "申请中",
  assigned: "已分配",
  in_progress: "执行中",
  submitted: "待验收",
  accepted: "已完成",
  rejected: "已退回",
  cancelled: "已取消",
  defaulted: "已违约",
};

export function getTaskStatusLabel(status: TaskStatus) {
  return TASK_STATUS_LABELS[status];
}

export function getTaskRewardLabel(task: Pick<TaskView, "status" | "rewardAmount" | "rewardCurrency">) {
  if (task.status === "draft") {
    return "待设置奖励";
  }

  return `${task.rewardAmount} ${task.rewardCurrency}`;
}

export function countOpenCreatedTasks(tasks: Array<Pick<TaskView, "status">>) {
  return tasks.filter((task) => task.status === "open" || task.status === "applying").length;
}
