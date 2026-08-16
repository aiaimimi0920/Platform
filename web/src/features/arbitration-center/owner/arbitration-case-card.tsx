import type { ArbitrationCaseView, ArbitrationWorkloadView } from "@neuro/contracts";
import {
  formatArbitrationTimelineKind,
  formatOwnerSafeArbitrationActor,
  formatOwnerSafeArbitrationTimelineTitle,
} from "@/app/arbitrations/presentation";
import { PreparedAttachmentUpload } from "@/components/arbitration/prepared-attachment-upload";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  arbitrationStatuses,
  evidenceKindLabel,
  formatArbitrationEntityType,
  formatReviewRoundStatus,
  formatStorageMode,
  formatTaskResolutionAction,
  formatUploadState,
  reputationImpactLabel,
  reputationImpactVariant,
  statusLabel,
  statusVariant,
  taskResolutionOptions,
  toLocaleDateTime,
  type ArbitrationCaseWithImpact,
} from "@/lib/arbitration-presentation";
import {
  addArbitrationEvidenceAction,
  advanceArbitrationReviewRoundAction,
  archiveArbitrationAttachmentAction,
  assignArbitrationCaseAction,
  claimArbitrationCaseAction,
  releaseArbitrationCaseAction,
  updateArbitrationCaseStatusAction,
} from "@/lib/platform-arbitration-actions";
import {
  renderArbitrationFollowUpFields,
  type ArbitrationCaseFilters,
} from "@/features/arbitration-center/shared/arbitration-follow-up-fields";

export function ArbitrationCaseCard({
  arbitrationCase,
  currentUserId,
  showOperatorMetadata,
  isOperator,
  arbitrationApiReady,
  arbitrationWorkload,
  filters,
  routePath,
}: {
  arbitrationCase: ArbitrationCaseView;
  currentUserId: string;
  showOperatorMetadata: boolean;
  isOperator: boolean;
  arbitrationApiReady: boolean;
  arbitrationWorkload: ArbitrationWorkloadView | null;
  filters: ArbitrationCaseFilters;
  routePath: string;
}) {
  const {
    caseIdFilter,
    caseStatusFilter,
    taskResolutionActionFilter,
    impactFilter,
    evidenceKindFilter,
    hasEvidenceFilter,
    assignmentFilter,
  } = filters;
  const arbitrationCaseWithImpact = arbitrationCase as ArbitrationCaseWithImpact;
  const impact = arbitrationCaseWithImpact.reputationImpactForViewer;
  const formatActor = (userId: string) =>
    showOperatorMetadata
      ? userId
      : formatOwnerSafeArbitrationActor(userId, {
          currentUserId,
          requesterUserId: arbitrationCase.requesterUserId,
          respondentUserId: arbitrationCase.respondentUserId,
        });
  return (
    <div className="app-task-card" key={arbitrationCase.id}>
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">{formatArbitrationEntityType(arbitrationCase.entityType)}</p>
          <h3 className="app-card-title">案件 {arbitrationCase.id}</h3>
        </div>
        <Badge variant={statusVariant[arbitrationCase.status]}>{statusLabel[arbitrationCase.status]}</Badge>
      </div>
      <p className="mg-copy">{arbitrationCase.reason}</p>
      <p className="app-note">{arbitrationCase.evidenceSummary || "未填写证据摘要。"}</p>
      <div className="app-stack">
        <div className="app-task-card__header">
          <div>
            <p className="mg-subtitle">证据对象</p>
            <h4 className="app-card-title">结构化证据</h4>
          </div>
          <Badge variant="cyan">{arbitrationCase.evidences.length} 条</Badge>
        </div>
        {arbitrationCase.evidences.length === 0 ? (
          <p className="app-note">当前还没有结构化证据对象，仍可先参考上方证据摘要。</p>
        ) : (
          <div className="app-task-list">
            {arbitrationCase.evidences.map((evidence) => (
              <div className="app-task-card" key={evidence.id}>
                <div className="app-task-card__header">
                  <div>
                    <p className="mg-subtitle">{evidenceKindLabel[evidence.kind]}</p>
                    <h5 className="app-card-title">{evidence.title}</h5>
                  </div>
                  <div className="app-inline-actions">
                    <Badge variant="cyan">{new Date(evidence.createdAt).toLocaleString("zh-CN")}</Badge>
                    <Badge variant="violet">{evidence.attachments.length} 个附件</Badge>
                  </div>
                </div>
                {evidence.content ? <p className="mg-copy">{evidence.content}</p> : null}
                {evidence.url ? (
                  <p className="app-note">
                    <a href={evidence.url} rel="noreferrer" target="_blank">
                      {evidence.url}
                    </a>
                  </p>
                ) : null}
                {evidence.attachments.length > 0 ? (
                  <div className="app-stack">
                    <p className="mg-subtitle">附件库</p>
                    <div className="app-task-list">
                      {evidence.attachments.map((attachment) => (
                        <div className="app-task-card" key={attachment.id}>
                          <div className="app-task-card__header">
                            <div>
                              <p className="mg-subtitle">{attachment.contentType}</p>
                              <h6 className="app-card-title">{attachment.fileName}</h6>
                            </div>
                            <div className="app-inline-actions">
                              <Badge variant="cyan">{Math.max(1, Math.ceil(attachment.sizeBytes / 1024))} KB</Badge>
                              <Badge variant={attachment.storageMode === "remote" ? "violet" : "cyan"}>
                                {formatStorageMode(attachment.storageMode)}
                              </Badge>
                              <Badge variant={attachment.uploadState === "uploaded" ? "success" : attachment.uploadState === "prepared" ? "warning" : "danger"}>
                                {formatUploadState(attachment.uploadState)}
                              </Badge>
                              {attachment.archivedAt ? <Badge variant="warning">已归档</Badge> : null}
                            </div>
                          </div>
                          <p className="app-note">上传人：{formatActor(attachment.uploaderUserId)}</p>
                          <p className="app-note">上传时间：{new Date(attachment.createdAt).toLocaleString("zh-CN")}</p>
                          <p className="app-note">
                            准备时间 {toLocaleDateTime(attachment.uploadPreparedAt)} / 完成时间 {toLocaleDateTime(attachment.uploadCompletedAt)}
                          </p>
                          {showOperatorMetadata ? (
                            <p className="app-note">
                              保留到期 {toLocaleDateTime(attachment.retentionExpiresAt)} / 清理请求 {toLocaleDateTime(attachment.cleanupRequestedAt)}
                            </p>
                          ) : null}
                          {showOperatorMetadata && attachment.remoteUrl ? <p className="app-note">远程地址：{attachment.remoteUrl}</p> : null}
                          {showOperatorMetadata && attachment.archivedAt ? (
                            <p className="app-note">
                              已归档：{new Date(attachment.archivedAt).toLocaleString("zh-CN")} / {attachment.archiveReason || "无"}
                            </p>
                          ) : null}
                          <div className="app-link-row">
                            {!attachment.archivedAt ? (
                              <a
                                className="mg-btn mg-btn--outline"
                                href={`/api/arbitration-attachments/${attachment.id}`}
                                rel="noreferrer"
                                target="_blank"
                              >
                                打开附件
                              </a>
                            ) : null}
                            {isOperator && attachment.storageMode === "remote" && !attachment.archivedAt ? (
                              <form action={archiveArbitrationAttachmentAction}>
                                <input name="attachmentId" type="hidden" value={attachment.id} />
                                {renderArbitrationFollowUpFields({
                                  caseStatus: caseStatusFilter,
                                  taskResolutionAction: taskResolutionActionFilter,
                                  impact: impactFilter,
                                  evidenceKind: evidenceKindFilter,
                                  hasEvidence: hasEvidenceFilter,
                                  assignment: assignmentFilter,
                                })}
                                <button className="mg-btn mg-btn--glass" type="submit">
                                  归档远程附件
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="app-note">提交人：{formatActor(evidence.creatorUserId)}</p>
                {arbitrationCase.canAddEvidence ? (
                  <PreparedAttachmentUpload
                    accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
                    evidenceId={evidence.id}
                    successMessage="证据附件已通过浏览器直传。"
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
        {arbitrationCase.canAddEvidence ? (
          <form action={addArbitrationEvidenceAction} className="app-form-grid">
            <input name="caseId" type="hidden" value={arbitrationCase.id} />
            {renderArbitrationFollowUpFields({
              caseId: caseIdFilter || arbitrationCase.id,
              caseStatus: caseStatusFilter,
              taskResolutionAction: taskResolutionActionFilter,
              impact: impactFilter,
              evidenceKind: evidenceKindFilter,
              hasEvidence: hasEvidenceFilter,
              assignment: assignmentFilter,
              routePath,
            })}
            <Select defaultValue="text_note" name="kind">
              {Object.entries(evidenceKindLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input name="title" placeholder="证据标题，例如：执行日志、截图说明、外链证据" required />
            <Textarea name="content" placeholder="证据内容或补充说明（文字/日志类必填）" rows={3} />
            <Input name="url" placeholder="https://example.com/evidence（链接/截图引用类必填）" type="url" />
            <button className="mg-btn mg-btn--outline" disabled={!arbitrationApiReady} type="submit">
              添加证据
            </button>
          </form>
        ) : (
          <p className="app-note">案件已结案或当前用户无权继续补充证据。</p>
        )}
      </div>
      <div className="app-detail-list">
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">关联任务</span>
          <span className="app-detail-list__value">{arbitrationCase.entityId}</span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">申请人</span>
          <span className="app-detail-list__value">{arbitrationCase.requesterUserId}</span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">被申请人</span>
          <span className="app-detail-list__value">{arbitrationCase.respondentUserId}</span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">创建时间</span>
          <span className="app-detail-list__value">{new Date(arbitrationCase.createdAt).toLocaleString("zh-CN")}</span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">裁决摘要</span>
          <span className="app-detail-list__value">{arbitrationCase.resolutionSummary || "尚无裁决摘要"}</span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">任务裁定动作</span>
          <span className="app-detail-list__value">
            {arbitrationCase.taskResolutionAction ? formatTaskResolutionAction(arbitrationCase.taskResolutionAction) : "未设置"}
          </span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">信誉影响</span>
          <span className="app-detail-list__value">
            {impact ? (
              <Badge variant={reputationImpactVariant[impact]}>{reputationImpactLabel[impact]}</Badge>
            ) : (
              "未评估"
            )}
          </span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">效果应用时间</span>
          <span className="app-detail-list__value">
            {arbitrationCase.effectsAppliedAt
              ? new Date(arbitrationCase.effectsAppliedAt).toLocaleString("zh-CN")
              : "未应用"}
          </span>
        </div>
        {showOperatorMetadata ? (
          <>
            <div className="app-detail-list__row">
              <span className="app-detail-list__label">当前认领</span>
              <span className="app-detail-list__value">
                {arbitrationCase.assignedOperatorUserId || "未认领"}
                {arbitrationCase.claimedAt
                  ? ` · ${new Date(arbitrationCase.claimedAt).toLocaleString("zh-CN")}`
                  : ""}
              </span>
            </div>
            <div className="app-detail-list__row">
              <span className="app-detail-list__label">认领时长</span>
              <span className="app-detail-list__value">
                {arbitrationCase.claimAgeHours !== null ? `${arbitrationCase.claimAgeHours} 小时` : "未认领"}
                {arbitrationCase.isStaleClaim ? " · 逾期认领" : ""}
              </span>
            </div>
          </>
        ) : null}
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">当前审理轮次</span>
          <span className="app-detail-list__value">第 {arbitrationCase.currentReviewRoundNumber} 轮</span>
        </div>
      </div>

      {arbitrationCase.reviewRounds?.length ? (
        <div className="app-stack">
          <h4 className="app-card-title">审理轮次</h4>
          <div className="app-task-list">
            {arbitrationCase.reviewRounds.map((round) => (
              <div className="app-task-card" key={round.id}>
                <div className="app-task-card__header">
                  <div>
                    <p className="mg-subtitle">第 {round.roundNumber} 轮</p>
                    <h5 className="app-card-title">{round.summary || "暂无轮次摘要"}</h5>
                  </div>
                  <div className="app-inline-actions">
                    <Badge variant={round.status === "completed" ? "success" : "cyan"}>
                      {formatReviewRoundStatus(round.status)}
                    </Badge>
                    {showOperatorMetadata && round.isRoundStale ? <Badge variant="danger">轮次逾期</Badge> : null}
                  </div>
                </div>
                <div className="app-detail-list">
                  {showOperatorMetadata ? (
                    <div className="app-detail-list__row">
                      <span className="app-detail-list__label">指派处理人</span>
                      <span className="app-detail-list__value">{round.assignedOperatorUserId || "未指定"}</span>
                    </div>
                  ) : null}
                  <div className="app-detail-list__row">
                    <span className="app-detail-list__label">开始</span>
                    <span className="app-detail-list__value">{new Date(round.startedAt).toLocaleString("zh-CN")}</span>
                  </div>
                  <div className="app-detail-list__row">
                    <span className="app-detail-list__label">结束</span>
                    <span className="app-detail-list__value">
                      {round.endedAt ? new Date(round.endedAt).toLocaleString("zh-CN") : "进行中"}
                    </span>
                  </div>
                  {showOperatorMetadata ? (
                  <div className="app-detail-list__row">
                    <span className="app-detail-list__label">轮次时长</span>
                    <span className="app-detail-list__value">
                      {round.roundAgeHours !== null ? `${round.roundAgeHours} 小时` : "暂无"}
                    </span>
                  </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isOperator ? (
        <div className="app-task-card__footer">
          {arbitrationCase.canClaim ? (
            <form action={claimArbitrationCaseAction}>
              <input name="caseId" type="hidden" value={arbitrationCase.id} />
              {renderArbitrationFollowUpFields({
                caseStatus: caseStatusFilter,
                taskResolutionAction: taskResolutionActionFilter,
                impact: impactFilter,
                evidenceKind: evidenceKindFilter,
                hasEvidence: hasEvidenceFilter,
                assignment: assignmentFilter,
              })}
              <button className="mg-btn mg-btn--glass" type="submit">
                认领案件
              </button>
            </form>
          ) : null}
          {arbitrationCase.canRelease ? (
            <form action={releaseArbitrationCaseAction}>
              <input name="caseId" type="hidden" value={arbitrationCase.id} />
              {renderArbitrationFollowUpFields({
                caseStatus: caseStatusFilter,
                taskResolutionAction: taskResolutionActionFilter,
                impact: impactFilter,
                evidenceKind: evidenceKindFilter,
                hasEvidence: hasEvidenceFilter,
                assignment: assignmentFilter,
              })}
              <button className="mg-btn mg-btn--outline" type="submit">
                释放案件
              </button>
            </form>
          ) : null}
          {arbitrationWorkload ? (
            <form action={assignArbitrationCaseAction} className="app-inline-actions">
              <input name="caseId" type="hidden" value={arbitrationCase.id} />
              {renderArbitrationFollowUpFields({
                caseStatus: caseStatusFilter,
                taskResolutionAction: taskResolutionActionFilter,
                impact: impactFilter,
                evidenceKind: evidenceKindFilter,
                hasEvidence: hasEvidenceFilter,
                assignment: assignmentFilter,
              })}
              <select className="mg-select" defaultValue={arbitrationWorkload.recommendedAssigneeUserId || ""} name="assigneeUserId">
                <option value="">选择处理人</option>
                {arbitrationWorkload.byAssignee.map((bucket) => (
                  <option key={bucket.key} value={bucket.key}>
                    {bucket.key} · 已认领 {bucket.claimedCount} · 逾期 {bucket.staleClaimCount}
                  </option>
                ))}
              </select>
              <button className="mg-btn mg-btn--secondary" type="submit">
                派单
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {isOperator && arbitrationCase.canAdvanceReviewRound ? (
        <Card className="app-stack">
          <h4 className="app-card-title">推进到下一轮审理</h4>
          <form action={advanceArbitrationReviewRoundAction} className="app-form-grid">
            <input name="caseId" type="hidden" value={arbitrationCase.id} />
            {renderArbitrationFollowUpFields({
              caseStatus: caseStatusFilter,
              taskResolutionAction: taskResolutionActionFilter,
              impact: impactFilter,
              evidenceKind: evidenceKindFilter,
              hasEvidence: hasEvidenceFilter,
              assignment: assignmentFilter,
            })}
            <Textarea name="summary" placeholder="本轮审理结论 / 交接说明" rows={3} />
            <Input name="assignToOperatorUserId" placeholder="下一轮运维用户 ID（可选）" />
            <button className="mg-btn mg-btn--secondary" type="submit">
              创建下一轮审理
            </button>
          </form>
        </Card>
      ) : null}

      <div className="app-stack">
        <h4 className="app-card-title">案件时间线</h4>
        <div className="app-task-list">
          {arbitrationCase.timeline.map((entry) => (
            <div className="app-task-card" key={`${arbitrationCase.id}-${entry.kind}-${entry.occurredAt}`}>
              <div className="app-task-card__header">
                <div>
                  <p className="mg-subtitle">
                    {showOperatorMetadata ? entry.kind : formatArbitrationTimelineKind(entry.kind)}
                  </p>
                  <h5 className="app-card-title">
                    {showOperatorMetadata
                      ? entry.title
                      : formatOwnerSafeArbitrationTimelineTitle(entry.kind)}
                  </h5>
                </div>
                <Badge variant="cyan">{new Date(entry.occurredAt).toLocaleString("zh-CN")}</Badge>
              </div>
              <p className="app-note">{entry.detail || "当前无补充说明。"}</p>
            </div>
          ))}
        </div>
      </div>
      {isOperator && arbitrationCase.canUpdateStatus ? (
        <div className="app-stack">
          {arbitrationStatuses.map((targetStatus) => (
            <form
              action={updateArbitrationCaseStatusAction}
              className="app-form-grid"
              key={`${arbitrationCase.id}-${targetStatus}`}
            >
            <input name="caseId" type="hidden" value={arbitrationCase.id} />
            <input name="status" type="hidden" value={targetStatus} />
            {renderArbitrationFollowUpFields({
              caseStatus: caseStatusFilter,
              taskResolutionAction: taskResolutionActionFilter,
              impact: impactFilter,
              evidenceKind: evidenceKindFilter,
              hasEvidence: hasEvidenceFilter,
              assignment: assignmentFilter,
            })}
            <Textarea
              name="resolutionSummary"
              placeholder={
                targetStatus === "under_review"
                  ? "补充审理说明（可选）"
                  : "填写裁决摘要，说明本次仲裁的结论与依据"
              }
              rows={targetStatus === "under_review" ? 2 : 3}
            />
            {targetStatus === "resolved" ? (
              <Select defaultValue="none" name="taskResolutionAction">
                {taskResolutionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : null}
            <button
              className="mg-btn mg-btn--outline"
              disabled={!arbitrationApiReady || arbitrationCase.status === targetStatus}
              type="submit"
            >
              设为 {statusLabel[targetStatus]}
            </button>
          </form>
        ))}
      </div>
      ) : isOperator ? (
        <p className="app-note">当前用户无权更新该案件状态。</p>
      ) : null}
    </div>
  );
}
