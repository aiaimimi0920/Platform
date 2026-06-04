/**
 * Project and investment project display — pure display, no config dialogs.
 * Shared between owner and visitor views.
 */
import { formatAccountNumber } from "@/lib/account-center";
import {
  AccountHomeList,
  AccountHomeRailCard,
} from "@/components/account-home/templates";

import type { AccountHonorProjectShowcase, AccountHonorSponsorshipSummary } from "../types";
import { formatHonorCurrencyValue } from "./honor-utils";

type ProjectListDisplayProps = {
  projects: AccountHonorProjectShowcase[];
  emptyLabel?: string;
};

export function ProjectListDisplay({ projects, emptyLabel = "暂无可展示的项目" }: ProjectListDisplayProps) {
  if (projects.length === 0) {
    return <p className="mg-copy">{emptyLabel}</p>;
  }

  return (
    <AccountHomeList>
      {projects.slice(0, 4).map((project) => (
        <div className="mg-terminal-list__row app-account-honor-project-row" key={project.id}>
          <div className="app-account-honor-project-row__body">
            <div className="mg-terminal-list__meta">
              <strong className="mg-terminal-list__title">{project.name}</strong>
              <span className="mg-terminal-list__subtitle">{project.summary}</span>
            </div>
            <div className="app-account-honor-project-metrics">
              <div className="app-account-honor-project-metrics__item">
                <span>资助人数</span>
                <strong>{formatAccountNumber(project.sponsorCount)}</strong>
              </div>
              <div className="app-account-honor-project-metrics__item">
                <span>资助总额</span>
                <strong>{`${formatAccountNumber(project.sponsoredAmount)} ${project.sponsoredCurrencyLabel}`}</strong>
              </div>
            </div>
          </div>
        </div>
      ))}
    </AccountHomeList>
  );
}

type SponsorshipSummaryDisplayProps = {
  summary: AccountHonorSponsorshipSummary;
};

export function SponsorshipSummaryDisplay({ summary }: SponsorshipSummaryDisplayProps) {
  return (
    <>
      <div className="app-account-honor-sponsor-summary">
        <div>
          <span>总投资额</span>
          <strong>{`${formatAccountNumber(summary.totalAmount)} ${summary.currencyLabel}`}</strong>
        </div>
        <div>
          <span>投资项目数</span>
          <strong>{formatAccountNumber(summary.sponsoredCount)}</strong>
        </div>
      </div>
      {summary.sponsoredProjects.length > 0 ? (
        <AccountHomeList>
          {summary.sponsoredProjects.map((project) => (
            <div className="mg-terminal-list__row app-account-honor-project-row" key={project.id}>
              <div className="app-account-honor-project-row__body">
                <div className="mg-terminal-list__meta">
                  <strong className="mg-terminal-list__title">{project.name}</strong>
                </div>
                <div className="app-account-honor-project-metrics">
                  <div className="app-account-honor-project-metrics__item">
                    <span>个人投资额</span>
                    <strong>{`${formatAccountNumber(project.sponsoredAmount)} ${project.sponsoredCurrencyLabel}`}</strong>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </AccountHomeList>
      ) : null}
    </>
  );
}
