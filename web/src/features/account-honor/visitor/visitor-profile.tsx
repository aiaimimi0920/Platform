/**
 * Visitor-facing read-only profile shell.
 * Shows avatar, username, tagline (not editable), rank, and the archive.
 * No editing controls, no POST calls, no config dialogs.
 */
import type {
  AccountHonorAbilityMetric,
  AccountHonorAgentShowcase,
  AccountHonorArchiveSectionProps,
  AccountHonorIssueShowcase,
  AccountHonorProjectShowcase,
  AccountHonorSponsorshipSummary,
  AccountHonorIssueSupportSummary,
  AccountHonorTaskPerformance,
} from "../types";
import { buildHonorRankLabel } from "../shared/honor-utils";
import { VisitorArchive } from "./visitor-archive";

type VisitorProfileProps = {
  accountAvatarUrl: string | null;
  accountDisplayName: string;
  profileTagline: string | null;
  trustLevel: number | null;
  abilityMetrics: AccountHonorAbilityMetric[];
  activityHeatmap: AccountHonorArchiveSectionProps["activityHeatmap"];
  agentShowcase: AccountHonorAgentShowcase[];
  taskPerformance: AccountHonorTaskPerformance;
  projectShowcase: AccountHonorProjectShowcase[];
  sponsorshipSummary: AccountHonorSponsorshipSummary;
  issueShowcase: AccountHonorIssueShowcase[];
  issueSupportSummary: AccountHonorIssueSupportSummary;
  progression: AccountHonorArchiveSectionProps["progression"];
};

export function VisitorProfile({
  accountAvatarUrl,
  accountDisplayName,
  profileTagline,
  trustLevel,
  abilityMetrics,
  activityHeatmap,
  agentShowcase,
  taskPerformance,
  projectShowcase,
  sponsorshipSummary,
  issueShowcase,
  issueSupportSummary,
  progression,
}: VisitorProfileProps) {
  const rankLabel = buildHonorRankLabel(progression, trustLevel);
  const fallback = accountDisplayName.slice(0, 1).toUpperCase();

  return (
    <div className="app-honor app-honor--visitor">
      <aside className="app-honor__rail">
        <div className="app-honor__rail-profile">
          <div className="app-honor__avatar">
            {accountAvatarUrl ? (
              <img alt={accountDisplayName} className="app-honor__avatar-image" src={accountAvatarUrl} />
            ) : (
              <span>{fallback}</span>
            )}
          </div>
          <div className="app-honor__rail-profile-copy">
            <div className="app-honor__identity-row">
              <span className="app-honor__rank-tag">{rankLabel}</span>
              <strong className="app-honor__rail-name">{accountDisplayName}</strong>
            </div>
            <div className="app-honor__tagline-row">
              <div className={`app-honor__tagline ${!profileTagline ? "app-honor__tagline--empty" : ""}`}>
                {profileTagline || "未设签名"}
              </div>
              {/* No edit button in visitor view */}
            </div>
          </div>
        </div>
      </aside>

      <div className="app-honor__content">
        <div className="app-honor__body">
          <VisitorArchive
            abilityMetrics={abilityMetrics}
            activityHeatmap={activityHeatmap}
            agentShowcase={agentShowcase}
            taskPerformance={taskPerformance}
            projectShowcase={projectShowcase}
            sponsorshipSummary={sponsorshipSummary}
            issueShowcase={issueShowcase}
            issueSupportSummary={issueSupportSummary}
            progression={progression}
          />
        </div>
      </div>
    </div>
  );
}
