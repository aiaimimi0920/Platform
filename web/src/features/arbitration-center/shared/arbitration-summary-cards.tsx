import type { ArbitrationCaseSummaryView, ArbitrationWorkloadView } from "@neuro/contracts";
import { Card } from "@/components/ui/card";
import {
  formatArbitrationStatus,
  formatBucketList,
  formatEvidenceKind,
  formatReputationImpact,
  formatTaskResolutionAction,
} from "@/lib/arbitration-presentation";

export function ArbitrationSummaryCards({
  arbitrationSummary,
  arbitrationWorkload,
}: {
  arbitrationSummary: ArbitrationCaseSummaryView;
  arbitrationWorkload: ArbitrationWorkloadView | null;
}) {
  return (
    <div className="app-wallet-grid">
      <Card className="app-currency-card">
        <p className="mg-subtitle">案件</p>
        <h2 className="app-card-title">总案件数</h2>
        <div className="app-currency-card__value">{arbitrationSummary.totalCount}</div>
        <p className="app-note">待处理人处理：{arbitrationSummary.awaitingOperatorCount}</p>
      </Card>
      <Card className="app-currency-card">
        <p className="mg-subtitle">按状态</p>
        <h2 className="app-card-title">状态分布</h2>
        <p className="app-note">{formatBucketList(arbitrationSummary.byStatus, formatArbitrationStatus)}</p>
      </Card>
      <Card className="app-currency-card">
        <p className="mg-subtitle">裁定</p>
        <h2 className="app-card-title">任务裁定动作</h2>
        <p className="app-note">{formatBucketList(arbitrationSummary.byTaskResolutionAction, formatTaskResolutionAction)}</p>
      </Card>
      <Card className="app-currency-card">
        <p className="mg-subtitle">影响</p>
        <h2 className="app-card-title">信誉影响</h2>
        <p className="app-note">{formatBucketList(arbitrationSummary.byReputationImpact, formatReputationImpact)}</p>
        <p className="app-note">已应用效果：{arbitrationSummary.resolvedWithEffectsCount}</p>
      </Card>
      <Card className="app-currency-card">
        <p className="mg-subtitle">证据</p>
        <h2 className="app-card-title">证据覆盖</h2>
        <p className="app-note">
          有证据案件：{arbitrationSummary.casesWithEvidenceCount} / 无证据案件：{arbitrationSummary.casesWithoutEvidenceCount}
        </p>
        <p className="app-note">证据总条数：{arbitrationSummary.evidenceCount}</p>
        <p className="app-note">
          远程附件：{arbitrationSummary.remoteAttachmentCount} / 请求清理 {arbitrationSummary.cleanupRequestedRemoteAttachmentCount} / 已归档 {arbitrationSummary.archivedRemoteAttachmentCount}
        </p>
        <p className="app-note">{formatBucketList(arbitrationSummary.byEvidenceKind, formatEvidenceKind)}</p>
      </Card>
      <Card className="app-currency-card">
        <p className="mg-subtitle">认领</p>
        <h2 className="app-card-title">认领状态</h2>
        <p className="app-note">已认领：{arbitrationSummary.claimedCount}</p>
        <p className="app-note">未认领：{arbitrationSummary.unclaimedCount}</p>
      </Card>
      {arbitrationWorkload ? (
        <Card className="app-currency-card">
          <p className="mg-subtitle">处理负载</p>
          <h2 className="app-card-title">工作负载</h2>
          <p className="app-note">我认领的案件：{arbitrationWorkload.mineCount}</p>
          <p className="app-note">逾期认领：{arbitrationWorkload.staleClaimedCount}</p>
          <p className="app-note">
            逾期轮次：{arbitrationWorkload.staleRoundCount}
            {arbitrationWorkload.oldestStaleRoundAgeHours !== null
              ? ` / 最早超期 ${arbitrationWorkload.oldestStaleRoundAgeHours} 小时`
              : ""}
          </p>
          <p className="app-note">
            推荐处理人：{arbitrationWorkload.recommendedAssigneeUserId || "暂无"}
          </p>
          <p className="app-note">
            自动释放：{arbitrationWorkload.autoReleaseEnabled ? "启用" : "未启用"}
            {arbitrationWorkload.autoReleaseIntervalMinutes
              ? ` / ${arbitrationWorkload.autoReleaseIntervalMinutes} 分钟`
              : ""}
          </p>
          <p className="app-note">
            下一条候选：
            {arbitrationWorkload.nextClaimCandidate
              ? `${arbitrationWorkload.nextClaimCandidate.caseId} / 第 ${arbitrationWorkload.nextClaimCandidate.currentReviewRoundNumber} 轮`
              : "暂无"}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
