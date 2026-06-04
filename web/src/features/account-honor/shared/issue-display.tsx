/**
 * Issue and investment issue display — pure display, no config dialogs.
 * Shared between owner and visitor views.
 */
import { formatAccountNumber } from "@/lib/account-center";
import {
  AccountHomeList,
} from "@/components/account-home/templates";

import type { AccountHonorIssueShowcase, AccountHonorIssueSupportSummary } from "../types";

type IssueListDisplayProps = {
  issues: AccountHonorIssueShowcase[];
  emptyLabel?: string;
};

export function IssueListDisplay({ issues, emptyLabel = "暂无可展示的议题" }: IssueListDisplayProps) {
  if (issues.length === 0) {
    return <p className="mg-copy">{emptyLabel}</p>;
  }

  return (
    <AccountHomeList>
      {issues.slice(0, 4).map((issue) => (
        <div className="mg-terminal-list__row app-account-honor-project-row" key={issue.id}>
          <div className="app-account-honor-project-row__body">
            <div className="mg-terminal-list__meta">
              <strong className="mg-terminal-list__title">{issue.name}</strong>
              <span className="mg-terminal-list__subtitle">{issue.summary}</span>
            </div>
            <div className="app-account-honor-project-metrics">
              <div className="app-account-honor-project-metrics__item">
                <span>支持人数</span>
                <strong>{formatAccountNumber(issue.supporterCount)}</strong>
              </div>
              <div className="app-account-honor-project-metrics__item">
                <span>支持票数</span>
                <strong>{`${formatAccountNumber(issue.supportedAmount)} ${issue.supportedCurrencyLabel}`}</strong>
              </div>
            </div>
          </div>
        </div>
      ))}
    </AccountHomeList>
  );
}

type IssueSupportSummaryDisplayProps = {
  summary: AccountHonorIssueSupportSummary;
};

export function IssueSupportSummaryDisplay({ summary }: IssueSupportSummaryDisplayProps) {
  return (
    <>
      <div className="app-account-honor-sponsor-summary">
        <div>
          <span>总投出票数</span>
          <strong>{`${formatAccountNumber(summary.totalAmount)} ${summary.currencyLabel}`}</strong>
        </div>
        <div>
          <span>投资议题数</span>
          <strong>{formatAccountNumber(summary.supportedCount)}</strong>
        </div>
      </div>
      {summary.supportedIssues.length > 0 ? (
        <AccountHomeList>
          {summary.supportedIssues.map((issue) => (
            <div className="mg-terminal-list__row app-account-honor-project-row" key={issue.id}>
              <div className="app-account-honor-project-row__body">
                <div className="mg-terminal-list__meta">
                  <strong className="mg-terminal-list__title">{issue.name}</strong>
                </div>
                <div className="app-account-honor-project-metrics">
                  <div className="app-account-honor-project-metrics__item">
                    <span>个人支持票数</span>
                    <strong>{`${formatAccountNumber(issue.supportedAmount)} ${issue.supportedCurrencyLabel}`}</strong>
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
