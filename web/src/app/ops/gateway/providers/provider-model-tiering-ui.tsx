"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
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

const MODEL_TIER_CARD_STYLE: CSSProperties = {
  flex: "0 1 260px",
  width: "min(100%, 280px)",
  padding: 18,
};

const SAVE_BUTTON_PENDING_STYLE: CSSProperties = { opacity: 0.76 };

const SAVE_BUTTON_READY_STYLE: CSSProperties = { opacity: 1 };

const TIER_TOGGLE_STYLE: CSSProperties = { width: 18, height: 18 };

const INLINE_TONE_STYLE: CSSProperties = { lineHeight: 1.5 };

const TIERING_INTRO_STYLE: CSSProperties = { maxWidth: 860 };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="nt-btn nt-btn--primary"
      disabled={pending}
      style={pending ? SAVE_BUTTON_PENDING_STYLE : SAVE_BUTTON_READY_STYLE}
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

  const handlePlatformTierChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setPlatformTier(event.target.value as PlatformTierValue);
  }, []);

  const handleEnabledChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEnabled(event.target.checked);
  }, []);

  const inlineToneClass =
    state.status === "success"
      ? "nt-text-xs nt-text-success"
      : state.status === "error"
        ? "nt-text-xs nt-text-danger"
        : null;

  return (
    <NtCard key={item.model} className="nt-card--outlined nt-stack nt-gap-3_5" style={MODEL_TIER_CARD_STYLE}>
      <div className="nt-stack nt-gap-1">
        <strong className="nt-credential-title nt-text-strong nt-break-word">{item.model}</strong>
      </div>
      <form action={formAction} className="nt-stack nt-gap-3_5">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="providerAccountId" value={providerAccountId} />
        <input type="hidden" name="model" value={item.model} />
        <label className="nt-stack nt-gap-1_5">
          <span className="nt-kicker">评级选择</span>
          <NtSelect
            name="platformTier"
            value={platformTier}
            onChange={handlePlatformTierChange}
          >
            {PLATFORM_TIER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NtSelect>
        </label>
        <label className="nt-stack nt-gap-1_5">
          <span className="nt-kicker">是否开启</span>
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={handleEnabledChange}
            style={TIER_TOGGLE_STYLE}
          />
        </label>
        <SaveButton />
        {state.message && inlineToneClass ? (
          <span className={inlineToneClass} style={INLINE_TONE_STYLE}>{state.message}</span>
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

  const modelCards = useMemo(
    () =>
      (tiering?.models ?? []).map((item) => (
        <ModelTieringCard
          key={`${item.model}:${item.platformTier}:${item.enabled}`}
          providerAccountId={providerAccountId}
          redirectTo={redirectTo}
          item={item}
        />
      )),
    [providerAccountId, redirectTo, tiering],
  );

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
          <p className="nt-text-sm nt-text-muted nt-flush" style={TIERING_INTRO_STYLE}>
            模型列表优先来自服务商 `/models` 自动返回；若上游不提供，则回退到当前配置中写好的模型列表。每个模型只维护评级和启用状态。
          </p>
          <div className="nt-flex nt-gap-2 nt-wrap">
            <NtBadge tone="secondary">服务商 {tiering.providerLabel}</NtBadge>
            <NtBadge tone="secondary">模型数 {tiering.models.length}</NtBadge>
          </div>
        </div>

        {tiering.models.length ? (
          <div className="nt-flex nt-wrap nt-gap-3_5 nt-items-start">
            {modelCards}
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
