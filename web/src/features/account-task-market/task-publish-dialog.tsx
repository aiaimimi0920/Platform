"use client";

import { useMemo, useState } from "react";

import { createTaskAction } from "@/lib/platform-actions";

type TaskPublishDialogProps = {
  defaultCapabilityCode?: string | null;
  defaultDescription?: string | null;
  defaultPricingMode?: "flat_task" | "token_metered";
  defaultRewardAmount?: number;
  defaultRewardCurrency?: "obsidian" | "mira";
  defaultTitle?: string | null;
  initialOpen?: boolean;
  redirectTo: string;
  triggerLabel?: string;
};

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-close__icon" viewBox="0 0 24 24">
      <path d="M6.5 6.5l11 11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M17.5 6.5l-11 11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function normalizeRewardAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function computeBondAmount(rewardAmount: number) {
  return Math.max(0, Math.ceil(rewardAmount * 0.3));
}

export function TaskPublishDialog({
  defaultCapabilityCode,
  defaultDescription,
  defaultPricingMode = "flat_task",
  defaultRewardAmount = 300,
  defaultRewardCurrency = "obsidian",
  defaultTitle,
  initialOpen = false,
  redirectTo,
  triggerLabel = "发布任务",
}: TaskPublishDialogProps) {
  const [open, setOpen] = useState(initialOpen);
  const [pricingMode, setPricingMode] = useState<"flat_task" | "token_metered">(defaultPricingMode);
  const [rewardAmountInput, setRewardAmountInput] = useState(String(defaultRewardAmount));
  const [rewardCurrency, setRewardCurrency] = useState<"obsidian" | "mira">(defaultRewardCurrency);

  const rewardAmount = useMemo(() => normalizeRewardAmount(rewardAmountInput), [rewardAmountInput]);
  const bondAmount = useMemo(() => computeBondAmount(rewardAmount), [rewardAmount]);
  const billingUnit = pricingMode === "token_metered" ? "1k_tokens" : "";
  const meterQuantity = pricingMode === "token_metered" ? "1" : "";

  return (
    <>
      <button className="nt-btn nt-btn--primary" onClick={() => setOpen(true)} type="button">
        {triggerLabel}
      </button>

      {open ? (
        <div className="app-task-market-subdialog" role="dialog" aria-modal="true" aria-label="发布任务">
          <button className="app-task-market-subdialog__backdrop" onClick={() => setOpen(false)} type="button" />
          <section className="nt-panel app-task-market-subdialog__panel">
            <div className="app-task-market-subdialog__head">
              <h2>发布任务</h2>
              <button
                aria-label="关闭发布任务弹窗"
                className="app-honor-close app-task-market-subdialog__close"
                onClick={() => setOpen(false)}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <form action={createTaskAction} className="nt-task-market-form app-task-market-subdialog__form">
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <input name="preferredCapabilityCodes" type="hidden" value={defaultCapabilityCode || ""} />
              <input name="operationMode" type="hidden" value="automatic" />
              <input name="billingUnit" type="hidden" value={billingUnit} />
              <input name="meterKey" type="hidden" value="" />
              <input name="meterQuantity" type="hidden" value={meterQuantity} />
              <input name="requiredBondAmount" type="hidden" value={bondAmount} />

              <div className="nt-task-market-form-grid app-task-market-subdialog__grid">
                <label className="nt-task-market-field nt-task-market-field--full">
                  <span>任务标题</span>
                  <input className="nt-input" defaultValue={defaultTitle || ""} name="title" required />
                </label>

                <label className="nt-task-market-field nt-task-market-field--full">
                  <span>任务说明</span>
                  <textarea className="nt-textarea" defaultValue={defaultDescription || ""} name="description" required rows={5} />
                </label>

                <label className="nt-task-market-field">
                  <span>计费模式</span>
                  <select
                    className="nt-select"
                    name="pricingMode"
                    onChange={(event) => setPricingMode(event.target.value === "token_metered" ? "token_metered" : "flat_task")}
                    value={pricingMode}
                  >
                    <option value="flat_task">按任务一口价</option>
                    <option value="token_metered">按 token 计费</option>
                  </select>
                </label>

                <label className="nt-task-market-field">
                  <span>奖励币种</span>
                  <select
                    className="nt-select"
                    name="rewardCurrency"
                    onChange={(event) => setRewardCurrency(event.target.value === "mira" ? "mira" : "obsidian")}
                    value={rewardCurrency}
                  >
                    <option value="obsidian">曜石</option>
                    <option value="mira">米拉</option>
                  </select>
                </label>

                <label className="nt-task-market-field">
                  <span>奖励金额</span>
                  <input
                    className="nt-input"
                    min="1"
                    name="rewardAmount"
                    onChange={(event) => setRewardAmountInput(event.target.value)}
                    required
                    type="number"
                    value={rewardAmountInput}
                  />
                </label>

                <label className="nt-task-market-field">
                  <span>保证金</span>
                  <input
                    className="nt-input"
                    readOnly
                    type="number"
                    value={String(bondAmount)}
                  />
                </label>
              </div>

              <div className="nt-task-market-inline-actions app-task-market-subdialog__actions">
                <button className="nt-btn nt-btn--primary" type="submit">
                  发布任务
                </button>
                <button className="nt-btn nt-btn--glass" onClick={() => setOpen(false)} type="button">
                  取消
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
