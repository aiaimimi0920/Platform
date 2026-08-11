"use client";

import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

import { joinProjectAction } from "../join-actions";

type ProjectJoinPanelProps = {
  action?: (formData: FormData) => void | Promise<void>;
  projectId: string;
  projectName: string;
  scope: string;
  ownerHandle: string | null;
  joinOpen: boolean;
  membershipStatus: "none" | "pending" | "active" | "rejected";
  membershipRoleLabel: string | null;
};

function JoinSubmitButton({
  disabled,
  membershipStatus,
}: {
  disabled: boolean;
  membershipStatus: ProjectJoinPanelProps["membershipStatus"];
}) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  const label = pending
    ? "提交中..."
    : membershipStatus === "active"
      ? "已加入"
      : membershipStatus === "pending"
        ? "等待审批"
        : "提交加入申请";

  return (
    <button
      className={cn(
        "mg-btn mg-btn--glass app-project-join-panel__submit",
        isDisabled && "mg-btn--disabled",
      )}
      disabled={isDisabled}
      type="submit"
    >
      {label}
    </button>
  );
}

export function ProjectJoinPanel({
  action = joinProjectAction,
  joinOpen,
  membershipRoleLabel,
  membershipStatus,
  ownerHandle,
  projectId,
  projectName,
  scope,
}: ProjectJoinPanelProps) {
  const disabled = !joinOpen || membershipStatus === "active";
  const statusLabel =
    membershipStatus === "pending"
      ? "加入申请进行中"
      : membershipStatus === "active"
        ? "已加入"
        : membershipStatus === "rejected"
          ? "加入请求被拒"
          : "可申请加入";
  const statusCopy =
    membershipStatus === "pending"
      ? "你的申请已经提交，当前等待项目方审核。"
      : membershipStatus === "active"
        ? membershipRoleLabel
          ? `你当前以 ${membershipRoleLabel} 身份参与该项目。`
          : "你已经加入该项目协作。"
        : membershipStatus === "rejected"
          ? "这次申请没有通过，你可以调整身份说明后重新提交。"
          : `当前站在 ${projectName} 的协作入口，可以直接提交加入申请。`;

  return (
    <section className="mg-terminal-section app-project-join-panel">
      <div className="app-project-join-panel__header">
        <h3 className="mg-card__title">
          {membershipStatus === "active" ? "项目协作身份" : "申请加入项目"}
        </h3>
        <Badge variant={joinOpen ? (disabled ? "secondary" : "success") : "warning"}>{statusLabel}</Badge>
      </div>

      <p className="mg-copy">{statusCopy}</p>

      <form action={action} className="app-project-join-panel__form">
        <input type="hidden" name="scope" value={scope} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="ownerHandle" value={ownerHandle ?? ""} />

        <label className="mg-label" htmlFor="roleLabel">
          角色 / 身份
        </label>
        <input
          id="roleLabel"
          name="roleLabel"
          className="mg-input"
          placeholder={membershipRoleLabel ?? "输入你希望承担的角色，例如：研究协同"}
          defaultValue={membershipRoleLabel ?? ""}
          required
          disabled={disabled}
        />

        <label className="mg-label" htmlFor="note">
          备注（可选）
        </label>
        <textarea
          id="note"
          name="note"
          className="mg-textarea"
          placeholder="你可以写当前想贡献的内容、可协调的时间段等。"
          rows={3}
          disabled={disabled}
        />

        <JoinSubmitButton disabled={disabled} membershipStatus={membershipStatus} />
      </form>
    </section>
  );
}
