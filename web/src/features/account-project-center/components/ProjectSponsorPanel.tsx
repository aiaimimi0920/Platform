"use client";

import { useMemo } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

import { sponsorProjectAction } from "../sponsor-actions";

type ProjectSponsorPanelProps = {
  action?: (formData: FormData) => void | Promise<void>;
  currentSponsoredAmount: number;
  currencyLabel: string;
  ownerHandle: string | null;
  personalSponsoredAmount: number;
  projectId: string;
  projectName: string;
  scope: string;
  sponsorOpen: boolean;
};

function resolveCurrencyToken(label: string) {
  return label.trim().toLowerCase() === "obsidian" ? "obsidian" : "mira";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function SponsorSubmitButton({ sponsorOpen }: { sponsorOpen: boolean }) {
  const { pending } = useFormStatus();
  const disabled = !sponsorOpen || pending;

  return (
    <button
      className={cn(
        "mg-btn mg-btn--glass app-project-sponsor-panel__submit",
        disabled && "mg-btn--disabled",
      )}
      disabled={disabled}
      type="submit"
    >
      {pending ? "提交中..." : sponsorOpen ? "确认赞助" : "暂不接收赞助"}
    </button>
  );
}

export function ProjectSponsorPanel({
  action = sponsorProjectAction,
  currentSponsoredAmount,
  currencyLabel,
  ownerHandle,
  personalSponsoredAmount,
  projectId,
  projectName,
  scope,
  sponsorOpen,
}: ProjectSponsorPanelProps) {
  const currencyToken = useMemo(() => resolveCurrencyToken(currencyLabel), [currencyLabel]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const amount = Number(new FormData(form).get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    if (!window.confirm(`是否确认以 ${amount} ${currencyLabel} 赞助项目 ${projectName}？`)) {
      event.preventDefault();
    }
  }

  return (
    <section className="mg-terminal-section app-project-sponsor-panel">
      <div className="app-project-sponsor-panel__header">
        <h3 className="mg-card__title">赞助项目</h3>
        <Badge variant={sponsorOpen ? "success" : "warning"}>{sponsorOpen ? "开放赞助" : "暂不接收赞助"}</Badge>
      </div>

      <div className="app-project-sponsor-panel__stats">
        <div>
          <span>当前赞助</span>
          <strong>
            {formatNumber(currentSponsoredAmount)} {currencyLabel}
          </strong>
        </div>
        <div>
          <span>我已赞助</span>
          <strong>
            {formatNumber(personalSponsoredAmount)} {currencyLabel}
          </strong>
        </div>
      </div>

      <p className="mg-copy">
        赞助金额会直接计入项目资金池。当前项目使用 <strong>{currencyLabel}</strong> 结算。
      </p>

      <form action={action} className="app-project-sponsor-panel__form" onSubmit={handleSubmit}>
        <input type="hidden" name="scope" value={scope} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="ownerHandle" value={ownerHandle ?? ""} />
        <input type="hidden" name="currency" value={currencyToken} />

        <label className="mg-label" htmlFor={`project-sponsor-${projectId}`}>
          赞助金额
        </label>
        <input
          className="mg-input"
          defaultValue=""
          disabled={!sponsorOpen}
          id={`project-sponsor-${projectId}`}
          inputMode="numeric"
          min="1"
          name="amount"
          placeholder={`输入赞助金额（${currencyLabel}）`}
          required
          type="number"
        />

        <SponsorSubmitButton sponsorOpen={sponsorOpen} />
      </form>
    </section>
  );
}
