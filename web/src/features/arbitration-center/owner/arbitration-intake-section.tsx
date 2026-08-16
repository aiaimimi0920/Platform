import type { TaskView } from "@neuro/contracts";
import { Card } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { createArbitrationCaseAction } from "@/lib/platform-arbitration-actions";
import {
  renderArbitrationFollowUpFields,
  type ArbitrationCaseFilters,
} from "@/features/arbitration-center/shared/arbitration-follow-up-fields";

export function ArbitrationIntakeSection({
  workspaceTasks,
  arbitrationApiReady,
  tasksUnavailable,
  filters,
  routePath,
}: {
  workspaceTasks: TaskView[];
  arbitrationApiReady: boolean;
  tasksUnavailable: boolean;
  filters: ArbitrationCaseFilters;
  routePath: string;
}) {
  return (
    <div className="app-shell-grid">
      <Card className="app-stack">
        <p className="mg-subtitle">发起案件</p>
        <h2 className="app-card-title">发起仲裁案件</h2>
        <form action={createArbitrationCaseAction} className="app-form-grid">
          {renderArbitrationFollowUpFields({
            caseId: filters.caseIdFilter,
            caseStatus: filters.caseStatusFilter,
            taskResolutionAction: filters.taskResolutionActionFilter,
            impact: filters.impactFilter,
            evidenceKind: filters.evidenceKindFilter,
            hasEvidence: filters.hasEvidenceFilter,
            assignment: filters.assignmentFilter,
            routePath,
          })}
          <label className="mg-label" htmlFor="arbitration-task-id">关联任务</label>
          <Select defaultValue="" id="arbitration-task-id" name="taskId" required>
            <option disabled value="">选择任务</option>
            {workspaceTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title} ({task.id})
              </option>
            ))}
          </Select>
          <label className="mg-label" htmlFor="arbitration-reason">仲裁理由</label>
          <Textarea id="arbitration-reason" name="reason" placeholder="填写仲裁理由，例如争议点、预期处理方式。" required rows={4} />
          <label className="mg-label" htmlFor="arbitration-evidence-summary">证据摘要（可选）</label>
          <Textarea id="arbitration-evidence-summary" name="evidenceSummary" placeholder="提交聊天记录、日志、截图说明。" rows={3} />
          <button className="mg-btn mg-btn--primary" disabled={!arbitrationApiReady || workspaceTasks.length === 0} type="submit">
            {tasksUnavailable
              ? "任务数据暂不可用"
              : workspaceTasks.length === 0
                ? "暂无任务可选"
                : arbitrationApiReady
                  ? "提交仲裁"
                  : "当前环境未启用提交"}
          </button>
        </form>
      </Card>

      <Card className="app-stack">
        <p className="mg-subtitle">案件规则</p>
        <h2 className="app-card-title">当前案件范围</h2>
        <div className="app-detail-list">
          <div className="app-detail-list__row">
            <span className="app-detail-list__label">实体类型</span>
            <span className="app-detail-list__value">任务</span>
          </div>
          <div className="app-detail-list__row">
            <span className="app-detail-list__label">状态流转</span>
            <span className="app-detail-list__value">待受理 → 审理中 → 已裁决 / 已驳回</span>
          </div>
          <div className="app-detail-list__row">
            <span className="app-detail-list__label">状态更新权限</span>
            <span className="app-detail-list__value">仅具备状态更新权限的案件可操作</span>
          </div>
        </div>
        <p className="app-note">
          当前围绕任务纠纷已经形成可操作闭环；更重的运维动作仍保留在当前仲裁台，而不是分散到账户首页摘要。
        </p>
      </Card>
    </div>
  );
}
