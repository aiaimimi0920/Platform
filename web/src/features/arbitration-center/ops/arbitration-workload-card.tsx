import type { ArbitrationWorkloadView } from "@neuro/contracts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatArbitrationStatus,
  formatBucketList,
  formatReviewRoundStatus,
} from "@/lib/arbitration-presentation";
import {
  claimNextArbitrationCaseAction,
  cleanupRemoteArbitrationAttachmentsAction,
  releaseStaleArbitrationCasesAction,
} from "@/lib/platform-arbitration-actions";
import {
  renderArbitrationFollowUpFields,
  type ArbitrationCaseFilters,
} from "@/features/arbitration-center/shared/arbitration-follow-up-fields";

export function ArbitrationWorkloadCard({
  arbitrationWorkload,
  filters,
}: {
  arbitrationWorkload: ArbitrationWorkloadView;
  filters: ArbitrationCaseFilters;
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">处理负载</p>
          <h2 className="app-card-title">认领队列与工作负载</h2>
        </div>
        <div className="app-inline-actions">
          <form action={claimNextArbitrationCaseAction}>
            {renderArbitrationFollowUpFields({
              caseStatus: filters.caseStatusFilter,
              taskResolutionAction: filters.taskResolutionActionFilter,
              impact: filters.impactFilter,
              evidenceKind: filters.evidenceKindFilter,
              hasEvidence: filters.hasEvidenceFilter,
              assignment: filters.assignmentFilter,
            })}
            <button className="mg-btn mg-btn--secondary" type="submit">
              认领下一条案件
            </button>
          </form>
          <form action={releaseStaleArbitrationCasesAction}>
            {renderArbitrationFollowUpFields({
              caseStatus: filters.caseStatusFilter,
              taskResolutionAction: filters.taskResolutionActionFilter,
              impact: filters.impactFilter,
              evidenceKind: filters.evidenceKindFilter,
              hasEvidence: filters.hasEvidenceFilter,
              assignment: filters.assignmentFilter,
            })}
            <input name="limit" type="hidden" value="20" />
            <button className="mg-btn mg-btn--glass" type="submit">
              释放逾期认领
            </button>
          </form>
          <form action={cleanupRemoteArbitrationAttachmentsAction}>
            {renderArbitrationFollowUpFields({
              caseStatus: filters.caseStatusFilter,
              taskResolutionAction: filters.taskResolutionActionFilter,
              impact: filters.impactFilter,
              evidenceKind: filters.evidenceKindFilter,
              hasEvidence: filters.hasEvidenceFilter,
              assignment: filters.assignmentFilter,
            })}
            <input name="limit" type="hidden" value="20" />
            <button className="mg-btn mg-btn--outline" type="submit">
              清理远程附件
            </button>
          </form>
        </div>
      </div>
      <div className="app-detail-list">
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">已认领 / 未认领 / 逾期</span>
          <span className="app-detail-list__value">
            {arbitrationWorkload.claimedCount} / {arbitrationWorkload.unclaimedCount} / {arbitrationWorkload.staleClaimedCount}
          </span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">当前处理人</span>
          <span className="app-detail-list__value">我认领的案件：{arbitrationWorkload.mineCount}</span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">逾期轮次</span>
          <span className="app-detail-list__value">
            {arbitrationWorkload.staleRoundCount}
            {arbitrationWorkload.oldestStaleRoundAgeHours !== null
              ? ` / 最早超期 ${arbitrationWorkload.oldestStaleRoundAgeHours} 小时`
              : ""}
          </span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">推荐分派</span>
          <span className="app-detail-list__value">{arbitrationWorkload.recommendedAssigneeUserId || "暂无"}</span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">自动释放策略</span>
          <span className="app-detail-list__value">
            {arbitrationWorkload.autoReleaseEnabled ? "启用" : "未启用"}
            {arbitrationWorkload.autoReleaseIntervalMinutes
              ? ` / ${arbitrationWorkload.autoReleaseIntervalMinutes} 分钟`
              : ""}
          </span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">按状态</span>
          <span className="app-detail-list__value">{formatBucketList(arbitrationWorkload.byStatus, formatArbitrationStatus)}</span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">按轮次状态</span>
          <span className="app-detail-list__value">{formatBucketList(arbitrationWorkload.byReviewRoundStatus, formatReviewRoundStatus)}</span>
        </div>
      </div>
      <div className="app-task-list">
        {arbitrationWorkload.byAssignee.map((bucket) => (
          <div className="app-task-card app-task-card--runtime-managed" key={bucket.key}>
            <div className="app-task-card__header">
              <div>
                <p className="mg-subtitle">处理人</p>
                <h3 className="app-card-title">{bucket.key}</h3>
              </div>
              <Badge variant={bucket.staleClaimCount > 0 ? "warning" : "cyan"}>
                逾期 {bucket.staleClaimCount}
              </Badge>
            </div>
            <div className="app-detail-list">
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">已认领</span>
                <span className="app-detail-list__value">{bucket.claimedCount}</span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">进行中轮次</span>
                <span className="app-detail-list__value">{bucket.openRoundCount}</span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">平均认领时长</span>
                <span className="app-detail-list__value">
                  {bucket.avgClaimAgeHours !== null ? `${bucket.avgClaimAgeHours} 小时` : "暂无"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
