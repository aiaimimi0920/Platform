"use client";

import { useEffect, useRef, useState } from "react";

import { formatAccountNumber } from "@/lib/account-center";
import { cn } from "@/lib/cn";

import {
  buildLocalIssueSupportSummary,
  buildLocalSponsorshipSummary,
  selectShowcasedIssues,
  selectShowcasedProjects,
} from "../shared";
import type { AccountHonorArchiveSectionProps } from "../types";

export type UseArchiveShowcaseConfigProps = Pick<
  AccountHonorArchiveSectionProps,
  | "issueCatalog"
  | "issueShowcase"
  | "issueSupportSummary"
  | "investmentIssueCatalog"
  | "investmentProjectCatalog"
  | "projectCatalog"
  | "projectShowcase"
  | "sponsorshipSummary"
>;

export function useArchiveShowcaseConfig({
  issueCatalog,
  issueShowcase,
  issueSupportSummary,
  investmentIssueCatalog,
  investmentProjectCatalog,
  projectCatalog,
  projectShowcase,
  sponsorshipSummary,
}: UseArchiveShowcaseConfigProps) {
  const mountedRef = useRef(false);
  const saveRequestIdRef = useRef(0);
  const [issueConfigOpen, setIssueConfigOpen] = useState(false);
  const [investmentIssueConfigOpen, setInvestmentIssueConfigOpen] = useState(false);
  const [projectConfigOpen, setProjectConfigOpen] = useState(false);
  const [investmentConfigOpen, setInvestmentConfigOpen] = useState(false);
  const [visibleIssueShowcase, setVisibleIssueShowcase] = useState(issueShowcase);
  const [visibleIssueSupportSummary, setVisibleIssueSupportSummary] = useState(issueSupportSummary);
  const [visibleProjectShowcase, setVisibleProjectShowcase] = useState(projectShowcase);
  const [visibleSponsorshipSummary, setVisibleSponsorshipSummary] = useState(sponsorshipSummary);
  const [issueDraftIds, setIssueDraftIds] = useState(issueShowcase.map((issue) => issue.id));
  const [investmentIssueDraftIds, setInvestmentIssueDraftIds] = useState(
    issueSupportSummary.supportedIssues.map((issue) => issue.id),
  );
  const [projectDraftIds, setProjectDraftIds] = useState(projectShowcase.map((project) => project.id));
  const [investmentDraftIds, setInvestmentDraftIds] = useState(
    sponsorshipSummary.sponsoredProjects.map((project) => project.id),
  );
  const [savingIssueShowcase, setSavingIssueShowcase] = useState(false);
  const [savingInvestmentIssueShowcase, setSavingInvestmentIssueShowcase] = useState(false);
  const [savingProjectShowcase, setSavingProjectShowcase] = useState(false);
  const [savingInvestmentShowcase, setSavingInvestmentShowcase] = useState(false);
  const [issueShowcaseError, setIssueShowcaseError] = useState<string | null>(null);
  const [investmentIssueShowcaseError, setInvestmentIssueShowcaseError] = useState<string | null>(null);
  const [projectShowcaseError, setProjectShowcaseError] = useState<string | null>(null);
  const [investmentShowcaseError, setInvestmentShowcaseError] = useState<string | null>(null);

  function invalidateSaveRequests() {
    saveRequestIdRef.current += 1;
    setSavingIssueShowcase(false);
    setSavingInvestmentIssueShowcase(false);
    setSavingProjectShowcase(false);
    setSavingInvestmentShowcase(false);
  }

  useEffect(() => {
    invalidateSaveRequests();
    setVisibleIssueShowcase(issueShowcase);
    setIssueDraftIds(issueShowcase.map((issue) => issue.id));
    setIssueConfigOpen(false);
    setIssueShowcaseError(null);
  }, [issueShowcase]);

  useEffect(() => {
    invalidateSaveRequests();
    setVisibleIssueSupportSummary(issueSupportSummary);
    setInvestmentIssueDraftIds(issueSupportSummary.supportedIssues.map((issue) => issue.id));
    setInvestmentIssueConfigOpen(false);
    setInvestmentIssueShowcaseError(null);
  }, [issueSupportSummary]);

  useEffect(() => {
    invalidateSaveRequests();
    setVisibleProjectShowcase(projectShowcase);
    setProjectDraftIds(projectShowcase.map((project) => project.id));
    setProjectConfigOpen(false);
    setProjectShowcaseError(null);
  }, [projectShowcase]);

  useEffect(() => {
    invalidateSaveRequests();
    setVisibleSponsorshipSummary(sponsorshipSummary);
    setInvestmentDraftIds(sponsorshipSummary.sponsoredProjects.map((project) => project.id));
    setInvestmentConfigOpen(false);
    setInvestmentShowcaseError(null);
  }, [sponsorshipSummary]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      saveRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!projectConfigOpen && !investmentConfigOpen && !issueConfigOpen && !investmentIssueConfigOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIssueConfigOpen(false);
        setInvestmentIssueConfigOpen(false);
        setProjectConfigOpen(false);
        setInvestmentConfigOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [investmentConfigOpen, investmentIssueConfigOpen, issueConfigOpen, projectConfigOpen]);

  function openIssueConfig() {
    setProjectConfigOpen(false);
    setInvestmentConfigOpen(false);
    setInvestmentIssueConfigOpen(false);
    setIssueDraftIds(visibleIssueShowcase.map((issue) => issue.id));
    setIssueShowcaseError(null);
    setIssueConfigOpen(true);
  }

  function openInvestmentIssueConfig() {
    setIssueConfigOpen(false);
    setProjectConfigOpen(false);
    setInvestmentConfigOpen(false);
    setInvestmentIssueDraftIds(visibleIssueSupportSummary.supportedIssues.map((issue) => issue.id));
    setInvestmentIssueShowcaseError(null);
    setInvestmentIssueConfigOpen(true);
  }

  function openProjectConfig() {
    setIssueConfigOpen(false);
    setInvestmentIssueConfigOpen(false);
    setInvestmentConfigOpen(false);
    setProjectDraftIds(visibleProjectShowcase.map((project) => project.id));
    setProjectShowcaseError(null);
    setProjectConfigOpen(true);
  }

  function openInvestmentConfig() {
    setIssueConfigOpen(false);
    setInvestmentIssueConfigOpen(false);
    setProjectConfigOpen(false);
    setInvestmentDraftIds(visibleSponsorshipSummary.sponsoredProjects.map((project) => project.id));
    setInvestmentShowcaseError(null);
    setInvestmentConfigOpen(true);
  }

  function toggleProjectConfig() {
    if (projectConfigOpen) {
      setProjectConfigOpen(false);
      return;
    }
    openProjectConfig();
  }

  function toggleInvestmentConfig() {
    if (investmentConfigOpen) {
      setInvestmentConfigOpen(false);
      return;
    }
    openInvestmentConfig();
  }

  function toggleIssueConfig() {
    if (issueConfigOpen) {
      setIssueConfigOpen(false);
      return;
    }
    openIssueConfig();
  }

  function toggleInvestmentIssueConfig() {
    if (investmentIssueConfigOpen) {
      setInvestmentIssueConfigOpen(false);
      return;
    }
    openInvestmentIssueConfig();
  }

  function toggleIssueDraft(issueId: string) {
    setIssueShowcaseError(null);
    setIssueDraftIds((current) => {
      if (current.includes(issueId)) {
        return current.filter((entry) => entry !== issueId);
      }

      if (current.length >= 4) {
        setIssueShowcaseError("最多展示 4 个议题");
        return current;
      }

      return [...current, issueId];
    });
  }

  function toggleInvestmentIssueDraft(issueId: string) {
    setInvestmentIssueShowcaseError(null);
    setInvestmentIssueDraftIds((current) => {
      if (current.includes(issueId)) {
        return current.filter((entry) => entry !== issueId);
      }

      if (current.length >= 3) {
        setInvestmentIssueShowcaseError("最多展示 3 个投资议题");
        return current;
      }

      return [...current, issueId];
    });
  }

  function toggleProjectDraft(projectId: string) {
    setProjectShowcaseError(null);
    setProjectDraftIds((current) => {
      if (current.includes(projectId)) {
        return current.filter((entry) => entry !== projectId);
      }

      if (current.length >= 4) {
        setProjectShowcaseError("最多展示 4 个项目");
        return current;
      }

      return [...current, projectId];
    });
  }

  function toggleInvestmentDraft(projectId: string) {
    setInvestmentShowcaseError(null);
    setInvestmentDraftIds((current) => {
      if (current.includes(projectId)) {
        return current.filter((entry) => entry !== projectId);
      }

      if (current.length >= 3) {
        setInvestmentShowcaseError("最多展示 3 个投资项目");
        return current;
      }

      return [...current, projectId];
    });
  }

  async function handleSaveProjectShowcase() {
    if (savingProjectShowcase) {
      return;
    }

    invalidateSaveRequests();
    setSavingProjectShowcase(true);
    setProjectShowcaseError(null);
    const requestId = saveRequestIdRef.current;
    const requestProjectDraftIds = [...projectDraftIds];

    try {
      const response = await fetch("/api/account-honor/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          honorShowcasedProjectIds: requestProjectDraftIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!mountedRef.current || saveRequestIdRef.current !== requestId) {
        return;
      }
      if (!response.ok) {
        throw new Error(payload?.error || "展示项目保存失败");
      }

      setVisibleProjectShowcase(selectShowcasedProjects(projectCatalog, projectDraftIds));
      setProjectConfigOpen(false);
    } catch (error) {
      if (!mountedRef.current || saveRequestIdRef.current !== requestId) {
        return;
      }
      setProjectShowcaseError(error instanceof Error ? error.message : "展示项目保存失败");
    } finally {
      if (mountedRef.current && saveRequestIdRef.current === requestId) {
        setSavingProjectShowcase(false);
      }
    }
  }

  async function handleSaveIssueShowcase() {
    if (savingIssueShowcase) {
      return;
    }

    invalidateSaveRequests();
    setSavingIssueShowcase(true);
    setIssueShowcaseError(null);
    const requestId = saveRequestIdRef.current;
    const requestIssueDraftIds = [...issueDraftIds];

    try {
      const response = await fetch("/api/account-honor/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          honorShowcasedIssueIds: requestIssueDraftIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!mountedRef.current || saveRequestIdRef.current !== requestId) {
        return;
      }
      if (!response.ok) {
        throw new Error(payload?.error || "议题展示保存失败");
      }

      setVisibleIssueShowcase(selectShowcasedIssues(issueCatalog, issueDraftIds));
      setIssueConfigOpen(false);
    } catch (error) {
      if (!mountedRef.current || saveRequestIdRef.current !== requestId) {
        return;
      }
      setIssueShowcaseError(error instanceof Error ? error.message : "议题展示保存失败");
    } finally {
      if (mountedRef.current && saveRequestIdRef.current === requestId) {
        setSavingIssueShowcase(false);
      }
    }
  }

  async function handleSaveInvestmentShowcase() {
    if (savingInvestmentShowcase) {
      return;
    }

    invalidateSaveRequests();
    setSavingInvestmentShowcase(true);
    setInvestmentShowcaseError(null);
    const requestId = saveRequestIdRef.current;
    const requestInvestmentDraftIds = [...investmentDraftIds];

    try {
      const response = await fetch("/api/account-honor/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          honorShowcasedInvestmentProjectIds: requestInvestmentDraftIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!mountedRef.current || saveRequestIdRef.current !== requestId) {
        return;
      }
      if (!response.ok) {
        throw new Error(payload?.error || "投资项目展示保存失败");
      }

      setVisibleSponsorshipSummary(buildLocalSponsorshipSummary(investmentProjectCatalog, investmentDraftIds));
      setInvestmentConfigOpen(false);
    } catch (error) {
      if (!mountedRef.current || saveRequestIdRef.current !== requestId) {
        return;
      }
      setInvestmentShowcaseError(error instanceof Error ? error.message : "投资项目展示保存失败");
    } finally {
      if (mountedRef.current && saveRequestIdRef.current === requestId) {
        setSavingInvestmentShowcase(false);
      }
    }
  }

  async function handleSaveInvestmentIssueShowcase() {
    if (savingInvestmentIssueShowcase) {
      return;
    }

    invalidateSaveRequests();
    setSavingInvestmentIssueShowcase(true);
    setInvestmentIssueShowcaseError(null);
    const requestId = saveRequestIdRef.current;
    const requestInvestmentIssueDraftIds = [...investmentIssueDraftIds];

    try {
      const response = await fetch("/api/account-honor/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          honorShowcasedInvestmentIssueIds: requestInvestmentIssueDraftIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!mountedRef.current || saveRequestIdRef.current !== requestId) {
        return;
      }
      if (!response.ok) {
        throw new Error(payload?.error || "投资议题展示保存失败");
      }

      setVisibleIssueSupportSummary(buildLocalIssueSupportSummary(investmentIssueCatalog, investmentIssueDraftIds));
      setInvestmentIssueConfigOpen(false);
    } catch (error) {
      if (!mountedRef.current || saveRequestIdRef.current !== requestId) {
        return;
      }
      setInvestmentIssueShowcaseError(error instanceof Error ? error.message : "投资议题展示保存失败");
    } finally {
      if (mountedRef.current && saveRequestIdRef.current === requestId) {
        setSavingInvestmentIssueShowcase(false);
      }
    }
  }

  const projectConfigPanel = projectConfigOpen ? (
    <div className="app-account-honor-inline-config" role="group" aria-label="项目展示配置">
      <div className="app-account-honor-inline-config__summary">
        <span>选择展示的被投资项目</span>
        <strong>{`${projectDraftIds.length}/4`}</strong>
      </div>
      {projectShowcaseError ? <p className="app-account-honor-agent-config__error">{projectShowcaseError}</p> : null}
      <div className="app-account-honor-inline-config__list">
        {projectCatalog.map((project) => {
          const selected = projectDraftIds.includes(project.id);
          return (
            <button
              className={cn(
                "app-account-honor-inline-config__option",
                selected && "app-account-honor-inline-config__option--selected",
              )}
              key={project.id}
              onClick={() => toggleProjectDraft(project.id)}
              type="button"
            >
              <div className="app-account-honor-inline-config__copy">
                <strong>{project.name}</strong>
                <span>{`${formatAccountNumber(project.sponsorCount)} 人 / ${formatAccountNumber(project.sponsoredAmount)} ${project.sponsoredCurrencyLabel}`}</span>
              </div>
              <span className="app-account-honor-inline-config__state">{selected ? "已展示" : "可展示"}</span>
            </button>
          );
        })}
      </div>
      <div className="app-account-honor-inline-config__actions">
        <button
          className="app-account-honor-agent-config__secondary"
          onClick={() => setProjectConfigOpen(false)}
          type="button"
        >
          取消
        </button>
        <button
          className="app-account-honor-agent-config__primary"
          disabled={savingProjectShowcase}
          onClick={() => void handleSaveProjectShowcase()}
          type="button"
        >
          {savingProjectShowcase ? "保存中" : "保存展示"}
        </button>
      </div>
    </div>
  ) : null;

  const investmentProjectConfigPanel = investmentConfigOpen ? (
    <div className="app-account-honor-inline-config" role="group" aria-label="投资项目展示配置">
      <div className="app-account-honor-inline-config__summary">
        <span>选择展示的投资项目</span>
        <strong>{`${investmentDraftIds.length}/3`}</strong>
      </div>
      {investmentShowcaseError ? <p className="app-account-honor-agent-config__error">{investmentShowcaseError}</p> : null}
      <div className="app-account-honor-inline-config__list">
        {investmentProjectCatalog.map((project) => {
          const selected = investmentDraftIds.includes(project.id);
          return (
            <button
              className={cn(
                "app-account-honor-inline-config__option",
                selected && "app-account-honor-inline-config__option--selected",
              )}
              key={project.id}
              onClick={() => toggleInvestmentDraft(project.id)}
              type="button"
            >
              <div className="app-account-honor-inline-config__copy">
                <strong>{project.name}</strong>
                <span>{`${formatAccountNumber(project.sponsoredAmount)} ${project.sponsoredCurrencyLabel}`}</span>
              </div>
              <span className="app-account-honor-inline-config__state">{selected ? "已展示" : "可展示"}</span>
            </button>
          );
        })}
      </div>
      <div className="app-account-honor-inline-config__actions">
        <button
          className="app-account-honor-agent-config__secondary"
          onClick={() => setInvestmentConfigOpen(false)}
          type="button"
        >
          取消
        </button>
        <button
          className="app-account-honor-agent-config__primary"
          disabled={savingInvestmentShowcase}
          onClick={() => void handleSaveInvestmentShowcase()}
          type="button"
        >
          {savingInvestmentShowcase ? "保存中" : "保存展示"}
        </button>
      </div>
    </div>
  ) : null;

  const issueConfigPanel = issueConfigOpen ? (
    <div className="app-account-honor-inline-config" role="group" aria-label="议题展示配置">
      <div className="app-account-honor-inline-config__summary">
        <span>选择展示的被投资议题</span>
        <strong>{`${issueDraftIds.length}/4`}</strong>
      </div>
      {issueShowcaseError ? <p className="app-account-honor-agent-config__error">{issueShowcaseError}</p> : null}
      <div className="app-account-honor-inline-config__list">
        {issueCatalog.map((issue) => {
          const selected = issueDraftIds.includes(issue.id);
          return (
            <button
              className={cn(
                "app-account-honor-inline-config__option",
                selected && "app-account-honor-inline-config__option--selected",
              )}
              key={issue.id}
              onClick={() => toggleIssueDraft(issue.id)}
              type="button"
            >
              <div className="app-account-honor-inline-config__copy">
                <strong>{issue.name}</strong>
                <span>{`${formatAccountNumber(issue.supporterCount)} 人 / ${formatAccountNumber(issue.supportedAmount)} ${issue.supportedCurrencyLabel}`}</span>
              </div>
              <span className="app-account-honor-inline-config__state">{selected ? "已展示" : "可展示"}</span>
            </button>
          );
        })}
      </div>
      <div className="app-account-honor-inline-config__actions">
        <button className="app-account-honor-agent-config__secondary" onClick={() => setIssueConfigOpen(false)} type="button">
          取消
        </button>
        <button
          className="app-account-honor-agent-config__primary"
          disabled={savingIssueShowcase}
          onClick={() => void handleSaveIssueShowcase()}
          type="button"
        >
          {savingIssueShowcase ? "保存中" : "保存展示"}
        </button>
      </div>
    </div>
  ) : null;

  const investmentIssueConfigPanel = investmentIssueConfigOpen ? (
    <div className="app-account-honor-inline-config" role="group" aria-label="投资议题展示配置">
      <div className="app-account-honor-inline-config__summary">
        <span>选择展示的投资议题</span>
        <strong>{`${investmentIssueDraftIds.length}/3`}</strong>
      </div>
      {investmentIssueShowcaseError ? (
        <p className="app-account-honor-agent-config__error">{investmentIssueShowcaseError}</p>
      ) : null}
      <div className="app-account-honor-inline-config__list">
        {investmentIssueCatalog.map((issue) => {
          const selected = investmentIssueDraftIds.includes(issue.id);
          return (
            <button
              className={cn(
                "app-account-honor-inline-config__option",
                selected && "app-account-honor-inline-config__option--selected",
              )}
              key={issue.id}
              onClick={() => toggleInvestmentIssueDraft(issue.id)}
              type="button"
            >
              <div className="app-account-honor-inline-config__copy">
                <strong>{issue.name}</strong>
                <span>{`${formatAccountNumber(issue.supportedAmount)} ${issue.supportedCurrencyLabel}`}</span>
              </div>
              <span className="app-account-honor-inline-config__state">{selected ? "已展示" : "可展示"}</span>
            </button>
          );
        })}
      </div>
      <div className="app-account-honor-inline-config__actions">
        <button
          className="app-account-honor-agent-config__secondary"
          onClick={() => setInvestmentIssueConfigOpen(false)}
          type="button"
        >
          取消
        </button>
        <button
          className="app-account-honor-agent-config__primary"
          disabled={savingInvestmentIssueShowcase}
          onClick={() => void handleSaveInvestmentIssueShowcase()}
          type="button"
        >
          {savingInvestmentIssueShowcase ? "保存中" : "保存展示"}
        </button>
      </div>
    </div>
  ) : null;

  return {
    investmentIssueConfigOpen,
    investmentIssueConfigPanel,
    investmentProjectConfigOpen: investmentConfigOpen,
    investmentProjectConfigPanel,
    issueConfigOpen,
    issueConfigPanel,
    projectConfigOpen,
    projectConfigPanel,
    toggleInvestmentIssueConfig,
    toggleInvestmentProjectConfig: toggleInvestmentConfig,
    toggleIssueConfig,
    toggleProjectConfig,
    visibleIssueShowcase,
    visibleIssueSupportSummary,
    visibleProjectShowcase,
    visibleSponsorshipSummary,
  };
}
