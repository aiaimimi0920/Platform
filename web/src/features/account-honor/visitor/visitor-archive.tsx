/**
 * Visitor-facing read-only archive view.
 * Composes shared display components without any editing controls.
 */
import {
  AccountHomeRailCard,
  AccountHomeSection,
  AccountHomeSectionHead,
} from "@/components/account-home/templates";

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
import { AbilityBoard, ActivityCard } from "../shared";
import { AgentShowcaseDisplay } from "../shared/agent-display";
import { ProjectListDisplay, SponsorshipSummaryDisplay } from "../shared/project-display";
import { IssueListDisplay, IssueSupportSummaryDisplay } from "../shared/issue-display";

type VisitorArchiveProps = {
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

export function VisitorArchive({
  abilityMetrics,
  activityHeatmap,
  agentShowcase,
  taskPerformance,
  projectShowcase,
  sponsorshipSummary,
  issueShowcase,
  issueSupportSummary,
  progression,
}: VisitorArchiveProps) {
  return (
    <AccountHomeSection>
      <div className="app-account-honor-top-grid">
        <AbilityBoard abilityMetrics={abilityMetrics} />
        <ActivityCard activityHeatmap={activityHeatmap} />
      </div>

      {/* Execution panel — read-only, no config button */}
      <AccountHomeRailCard className="app-account-honor-card app-account-honor-card--performance app-account-honor-card--execution-panel">
        <div className="app-account-honor-inline-head">
          <span className="mg-terminal-kicker">执行力</span>
        </div>
        <AgentShowcaseDisplay
          agentShowcase={agentShowcase}
          taskPerformance={taskPerformance}
        />
      </AccountHomeRailCard>

      {/* Projects — read-only, no config buttons */}
      <div className="app-account-honor-grid app-account-honor-grid--secondary">
        <AccountHomeRailCard className="app-account-honor-card">
          <div className="app-account-honor-inline-head">
            <span className="mg-terminal-kicker">项目</span>
          </div>
          <ProjectListDisplay projects={projectShowcase} />
        </AccountHomeRailCard>

        <AccountHomeRailCard className="app-account-honor-card app-account-honor-card--investment">
          <div className="app-account-honor-inline-head">
            <span className="mg-terminal-kicker">投资项目</span>
          </div>
          <SponsorshipSummaryDisplay summary={sponsorshipSummary} />
        </AccountHomeRailCard>
      </div>

      {/* Issues — read-only, no config buttons */}
      <div className="app-account-honor-grid app-account-honor-grid--secondary">
        <AccountHomeRailCard className="app-account-honor-card">
          <div className="app-account-honor-inline-head">
            <span className="mg-terminal-kicker">议题</span>
          </div>
          <IssueListDisplay issues={issueShowcase} />
        </AccountHomeRailCard>

        <AccountHomeRailCard className="app-account-honor-card app-account-honor-card--investment">
          <div className="app-account-honor-inline-head">
            <span className="mg-terminal-kicker">投资议题</span>
          </div>
          <IssueSupportSummaryDisplay summary={issueSupportSummary} />
        </AccountHomeRailCard>
      </div>
    </AccountHomeSection>
  );
}
