import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  arbitrationStatusOptions,
  evidenceKindLabel,
  reputationImpactLabel,
  statusLabel,
  taskResolutionOptions,
} from "@/lib/arbitration-presentation";
import type { ArbitrationCaseFilters } from "@/features/arbitration-center/shared/arbitration-follow-up-fields";

export function ArbitrationCaseFiltersCard({
  routePath,
  filters,
  showOperatorMetadata,
}: {
  routePath: string;
  filters: ArbitrationCaseFilters;
  showOperatorMetadata: boolean;
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">处理筛选</p>
          <h2 className="app-card-title">筛选仲裁案件</h2>
        </div>
      </div>
      <form action={routePath} className="app-form-grid" method="get">
        <Input defaultValue={filters.caseIdFilter} name="caseId" placeholder="案件 ID（可选）" />
        <select className="mg-select" name="caseStatus" defaultValue={filters.caseStatusFilter}>
          <option value="">全部状态</option>
          {arbitrationStatusOptions.map((statusOption) => (
            <option key={statusOption} value={statusOption}>
              {statusLabel[statusOption]}
            </option>
          ))}
        </select>
        <select className="mg-select" name="taskResolutionAction" defaultValue={filters.taskResolutionActionFilter}>
          <option value="">全部任务裁定动作</option>
          {taskResolutionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select className="mg-select" name="impact" defaultValue={filters.impactFilter}>
          <option value="">全部信誉影响</option>
          {Object.entries(reputationImpactLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select className="mg-select" name="hasEvidence" defaultValue={filters.hasEvidenceFilter}>
          <option value="">全部证据覆盖</option>
          <option value="with">仅看有证据</option>
          <option value="without">仅看无证据</option>
        </select>
        <select className="mg-select" name="evidenceKind" defaultValue={filters.evidenceKindFilter}>
          <option value="">全部证据类型</option>
          {Object.entries(evidenceKindLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {showOperatorMetadata ? (
          <select className="mg-select" name="assignment" defaultValue={filters.assignmentFilter}>
          <option value="">全部认领状态</option>
          <option value="claimed">仅看已认领</option>
          <option value="unclaimed">仅看未认领</option>
          <option value="mine">仅看我认领的案件</option>
          </select>
        ) : null}
        <button className="mg-btn mg-btn--secondary" type="submit">
          应用筛选
        </button>
      </form>
    </Card>
  );
}
