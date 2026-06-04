"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { useAppToast } from "@/components/app-toast-center";
import { NtBadge, NtCard, NtPanel, NtSelect } from "@/components/nt-primitives";
import type { GatewayProviderModelTieringView } from "@/lib/account-client";

import {
  saveGatewayProviderModelTieringAction,
  type GatewayProviderModelTieringActionState,
} from "./actions";

const PLATFORM_TIER_OPTIONS = [
  { value: "low", label: "低评级" },
  { value: "mid", label: "中评级" },
  { value: "high", label: "高评级" },
] as const;

type PlatformTierValue = (typeof PLATFORM_TIER_OPTIONS)[number]["value"];

function cardStyle() {
  return {
    flex: "0 1 260px",
    width: "min(100%, 280px)",
    display: "grid",
    gap: 14,
    padding: 18,
  } as const;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="nt-button nt-button--primary"
      disabled={pending}
      style={{ opacity: pending ? 0.76 : 1 }}
    >
      {pending ? "保存中..." : "保存"}
    </button>
  );
}

function ModelTieringCard(props: {
  providerAccountId: string;
  redirectTo: string;
  item: GatewayProviderModelTieringView["models"][number];
}) {
  const { providerAccountId, redirectTo, item } = props;
  const { pushToast } = useAppToast();
  const [platformTier, setPlatformTier] = useState<PlatformTierValue>(item.platformTier as PlatformTierValue);
  const [enabled, setEnabled] = useState(item.enabled);
  const lastHandledAtRef = useRef(0);
  const initialState: GatewayProviderModelTieringActionState = {
    status: "idle",
    message: null,
    model: item.model,
    platformTier: item.platformTier,
    enabled: item.enabled,
    submittedAt: 0,
  };
  const [state, formAction] = useActionState(saveGatewayProviderModelTieringAction, initialState);

  useEffect(() => {
    setPlatformTier(item.platformTier as PlatformTierValue);
    setEnabled(item.enabled);
  }, [item.enabled, item.platformTier]);

  useEffect(() => {
    if (!state.submittedAt || state.submittedAt === lastHandledAtRef.current || !state.message) {
      return;
    }
    lastHandledAtRef.current = state.submittedAt;
    if (state.status === "success") {
      setPlatformTier(state.platformTier as PlatformTierValue);
      setEnabled(state.enabled);
      pushToast({
        tone: "success",
        title: "保存成功",
        message: state.message,
      });
      return;
    }
    pushToast({
      tone: "error",
      title: "保存失败",
      message: state.message,
    });
  }, [pushToast, state]);

  const inlineTone =
    state.status === "success" ? "rgba(134,239,172,0.92)" : state.status === "error" ? "rgba(253,164,175,0.96)" : null;

  return (
    <NtCard key={item.model} className="nt-card--outlined" style={cardStyle()}>
      <div className="nt-stack nt-gap-1">
        <strong style={{ fontSize: "1rem", color: "rgba(245,247,250,0.96)", wordBreak: "break-word" }}>{item.model}</strong>
      </div>
      <form action={formAction} style={{ display: "grid", gap: 14 }}>
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="providerAccountId" value={providerAccountId} />
        <input type="hidden" name="model" value={item.model} />
        <label style={{ display: "grid", gap: 6 }}>
          <span className="nt-kicker">评级选择</span>
          <NtSelect
            name="platformTier"
            value={platformTier}
            onChange={(event) => setPlatformTier(event.target.value as PlatformTierValue)}
          >
            {PLATFORM_TIER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NtSelect>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="nt-kicker">是否开启</span>
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            style={{ width: 18, height: 18 }}
          />
        </label>
        <SaveButton />
        {state.message && inlineTone ? (
          <span style={{ color: inlineTone, fontSize: "0.82rem", lineHeight: 1.5 }}>{state.message}</span>
        ) : null}
      </form>
    </NtCard>
  );
}

export function ProviderModelTieringSection(props: {
  providerAccountId: string;
  redirectTo: string;
  tiering: GatewayProviderModelTieringView | null;
  loadError?: string | null;
}) {
  const { providerAccountId, redirectTo, tiering, loadError } = props;

  if (!tiering) {
    return (
      <NtPanel title="服务端模型定级">
        <NtCard className="nt-card--outlined">
          <span className="nt-text-sm nt-text-muted">
            {loadError || "当前暂时无法读取模型定级信息，但服务商详情与凭证治理仍可继续使用。"}
          </span>
        </NtCard>
      </NtPanel>
    );
  }

  return (
    <NtPanel title="服务端模型定级">
      <div className="nt-stack nt-gap-4">
        <div className="nt-stack nt-gap-2">
          <p className="nt-text-sm nt-text-muted" style={{ margin: 0, maxWidth: 860 }}>
            模型列表优先来自服务商 `/models` 自动返回；若上游不提供，则回退到当前配置中写好的模型列表。每个模型只维护评级和启用状态。
          </p>
          <div className="nt-flex" style={{ gap: 8, flexWrap: "wrap" }}>
            <NtBadge tone="secondary">服务商 {tiering.providerLabel}</NtBadge>
            <NtBadge tone="secondary">模型数 {tiering.models.length}</NtBadge>
          </div>
        </div>

        {tiering.models.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
            {tiering.models.map((item) => (
              <ModelTieringCard
                key={`${item.model}:${item.platformTier}:${item.enabled}`}
                providerAccountId={providerAccountId}
                redirectTo={redirectTo}
                item={item}
              />
            ))}
          </div>
        ) : (
          <NtCard className="nt-card--outlined">
            <span className="nt-text-sm nt-text-muted">
              当前还没有可用于定级的模型列表。先确认服务商 `/models` 可读，或在配置中补充固定模型列表。
            </span>
          </NtCard>
        )}
      </div>
    </NtPanel>
  );
}
