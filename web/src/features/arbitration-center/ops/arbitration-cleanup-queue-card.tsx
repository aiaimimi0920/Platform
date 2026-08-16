import type { ArbitrationRemoteAttachmentCleanupQueueView } from "@neuro/contracts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatArbitrationStatus,
  formatBucketList,
  formatCleanupRequestState,
  formatRemoteConfigState,
  formatRemoteUploadStrategy,
  formatStorageMode,
  statusLabel,
  toLocaleDateTime,
} from "@/lib/arbitration-presentation";
import {
  archiveArbitrationAttachmentAction,
  requestArbitrationAttachmentCleanupAction,
} from "@/lib/platform-arbitration-actions";
import {
  renderArbitrationFollowUpFields,
  type ArbitrationCaseFilters,
} from "@/features/arbitration-center/shared/arbitration-follow-up-fields";

export function ArbitrationCleanupQueueCard({
  cleanupQueue,
  filters,
}: {
  cleanupQueue: ArbitrationRemoteAttachmentCleanupQueueView;
  filters: ArbitrationCaseFilters;
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">清理队列</p>
          <h2 className="app-card-title">远程附件保留与清理</h2>
        </div>
      </div>
      <div className="app-detail-list">
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">存储策略</span>
          <span className="app-detail-list__value">
            {formatStorageMode(cleanupQueue.policy.storageMode)} / {formatRemoteUploadStrategy(cleanupQueue.policy.remoteUploadStrategy)}
            {cleanupQueue.policy.remoteProviderKey ? ` / ${cleanupQueue.policy.remoteProviderKey}` : ""}
          </span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">待清理 / 当前到期</span>
          <span className="app-detail-list__value">
            {cleanupQueue.pendingCount} / {cleanupQueue.dueNowCount}
          </span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">已请求清理</span>
          <span className="app-detail-list__value">{cleanupQueue.cleanupRequestedCount}</span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">清理失败 / 最大尝试</span>
          <span className="app-detail-list__value">
            {cleanupQueue.failedCount} / {cleanupQueue.policy.cleanupMaxAttempts}
          </span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">最早保留到期</span>
          <span className="app-detail-list__value">{toLocaleDateTime(cleanupQueue.oldestRetentionExpiresAt)}</span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">按案件状态</span>
          <span className="app-detail-list__value">{formatBucketList(cleanupQueue.byCaseStatus, formatArbitrationStatus)}</span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">远程配置</span>
          <span className="app-detail-list__value">
            {formatRemoteConfigState(cleanupQueue.policy.remoteBaseUrlConfigured, "读取地址已配置", "读取地址未配置")} /{" "}
            {formatRemoteConfigState(cleanupQueue.policy.remoteUploadBaseUrlConfigured, "上传地址已配置", "上传地址未配置")} /{" "}
            {formatRemoteConfigState(cleanupQueue.policy.remoteAuthConfigured, "鉴权已配置", "鉴权未配置")}
          </span>
        </div>
      </div>
      {cleanupQueue.candidates.length > 0 ? (
        <div className="app-task-list">
          {cleanupQueue.candidates.slice(0, 6).map((candidate) => (
            <div className="app-task-card" key={candidate.attachmentId}>
              <div className="app-task-card__header">
                <div>
                  <p className="mg-subtitle">{statusLabel[candidate.caseStatus]}</p>
                  <h3 className="app-card-title">{candidate.fileName}</h3>
                </div>
                <div className="app-inline-actions">
                  <Badge variant={candidate.cleanupRequestedAt ? "warning" : "cyan"}>
                    {formatCleanupRequestState(candidate.cleanupRequestedAt)}
                  </Badge>
                  {candidate.hoursPastRetention !== null && candidate.hoursPastRetention > 0 ? (
                    <Badge variant="danger">{candidate.hoursPastRetention} 小时超期</Badge>
                  ) : null}
                </div>
              </div>
              <p className="app-note">
                案件 {candidate.caseId} / 证据 {candidate.evidenceId}
              </p>
              <p className="app-note">
                保留到期 {toLocaleDateTime(candidate.retentionExpiresAt)} / 清理请求{" "}
                {toLocaleDateTime(candidate.cleanupRequestedAt)}
              </p>
              <p className="app-note">
                清理尝试 {candidate.cleanupAttemptCount} 次 / 最近尝试{" "}
                {toLocaleDateTime(candidate.lastCleanupAttemptAt)}
              </p>
              {candidate.lastCleanupError ? (
                <p className="app-note">最近清理错误：{candidate.lastCleanupError}</p>
              ) : null}
              <div className="app-link-row">
                {!candidate.cleanupRequestedAt ? (
                  <form action={requestArbitrationAttachmentCleanupAction}>
                    <input name="attachmentId" type="hidden" value={candidate.attachmentId} />
                    {renderArbitrationFollowUpFields({
                      caseStatus: filters.caseStatusFilter,
                      taskResolutionAction: filters.taskResolutionActionFilter,
                      impact: filters.impactFilter,
                      evidenceKind: filters.evidenceKindFilter,
                      hasEvidence: filters.hasEvidenceFilter,
                      assignment: filters.assignmentFilter,
                    })}
                    <button className="mg-btn mg-btn--outline" type="submit">
                      请求清理
                    </button>
                  </form>
                ) : null}
                <form action={archiveArbitrationAttachmentAction}>
                  <input name="attachmentId" type="hidden" value={candidate.attachmentId} />
                  {renderArbitrationFollowUpFields({
                    caseStatus: filters.caseStatusFilter,
                    taskResolutionAction: filters.taskResolutionActionFilter,
                    impact: filters.impactFilter,
                    evidenceKind: filters.evidenceKindFilter,
                    hasEvidence: filters.hasEvidenceFilter,
                    assignment: filters.assignmentFilter,
                  })}
                  <button className="mg-btn mg-btn--glass" type="submit">
                    立即归档
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mg-copy">当前没有待观察的远程附件保留队列。</p>
      )}
    </Card>
  );
}
