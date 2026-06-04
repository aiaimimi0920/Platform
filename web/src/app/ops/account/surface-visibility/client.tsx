"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { PublicSurfaceSnapshot } from "@neuro/contracts";
import { useFormStatus } from "react-dom";

import { useAppToast } from "@/components/app-toast-center";
import { NtBadge, NtCard, NtPanel } from "@/components/nt-primitives";
import { PUBLIC_SURFACE_DEFINITIONS, type PublicSurfaceDefinition } from "@/lib/public-surface-visibility";

import {
  savePublicSurfaceVisibilityAction,
  type PublicSurfaceVisibilityActionState,
} from "./actions";

type Props = {
  snapshot: PublicSurfaceSnapshot;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="nt-btn nt-btn--primary" disabled={pending} type="submit">
      {pending ? "保存中..." : "保存外放设置"}
    </button>
  );
}

export function PublicSurfaceVisibilityClient({ snapshot }: Props) {
  const { pushToast } = useAppToast();
  const grouped = useMemo(() => {
    return PUBLIC_SURFACE_DEFINITIONS.reduce<Record<string, PublicSurfaceDefinition[]>>((acc, item) => {
      if (!acc[item.group]) {
        acc[item.group] = [];
      }
      acc[item.group].push(item);
      return acc;
    }, {});
  }, []);

  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(PUBLIC_SURFACE_DEFINITIONS.map((definition) => [definition.key, snapshot[definition.key].enabled])),
  );
  const lastHandledAtRef = useRef(0);
  const initialState: PublicSurfaceVisibilityActionState = {
    status: "idle",
    message: null,
    snapshot,
    submittedAt: 0,
  };
  const [state, formAction] = useActionState(savePublicSurfaceVisibilityAction, initialState);

  useEffect(() => {
    const nextSnapshot = state.snapshot ?? snapshot;
    setToggles(
      Object.fromEntries(
        PUBLIC_SURFACE_DEFINITIONS.map((definition) => [definition.key, nextSnapshot[definition.key].enabled]),
      ),
    );
  }, [snapshot, state.snapshot]);

  useEffect(() => {
    if (!state.submittedAt || state.submittedAt === lastHandledAtRef.current || !state.message) {
      return;
    }
    lastHandledAtRef.current = state.submittedAt;
    pushToast({
      tone: state.status === "success" ? "success" : "error",
      title: state.status === "success" ? "保存成功" : "保存失败",
      message: state.message,
    });
  }, [pushToast, state]);

  const enabledCount = Object.values(toggles).filter(Boolean).length;

  return (
    <NtPanel>
      <div className="nt-stack nt-gap-4">
        <div className="nt-stack nt-gap-2">
          <span className="nt-kicker">Operator / Surface Visibility</span>
          <h1 className="mg-title" style={{ margin: 0 }}>
            前台界面外放
          </h1>
          <p className="nt-text-sm nt-text-muted" style={{ margin: 0, maxWidth: 920 }}>
            这里控制普通访问者能否看到前台按钮和对应界面。管理员账号与 Local Dev 始终全显，不受这里的开关影响。
          </p>
          <div className="nt-flex" style={{ gap: 8, flexWrap: "wrap" }}>
            <NtBadge tone="secondary">已外放 {enabledCount}</NtBadge>
            <NtBadge tone="secondary">总入口 {PUBLIC_SURFACE_DEFINITIONS.length}</NtBadge>
            <NtBadge tone="glass">管理员 / DEV 永远可见</NtBadge>
          </div>
        </div>

        <form action={formAction} className="nt-stack nt-gap-4">
          {Object.entries(grouped).map(([group, items]) => (
            <section className="nt-stack nt-gap-3" key={group}>
              <div className="nt-stack nt-gap-1">
                <span className="nt-kicker">{group}</span>
                <p className="nt-text-sm nt-text-muted" style={{ margin: 0 }}>
                  {group === "终端入口"
                    ? "主要控制控制台顶部按钮和弹层入口。"
                    : "主要控制深链接页面与独立界面入口。"}
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
                {items.map((item) => (
                  <NtCard
                    className="nt-card--outlined"
                    key={item.key}
                    style={{ flex: "0 1 320px", width: "min(100%, 340px)", display: "grid", gap: 14, padding: 18 }}
                  >
                    <div className="nt-stack nt-gap-2">
                      <div
                        className="nt-flex"
                        style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}
                      >
                        <div className="nt-stack nt-gap-1">
                          <strong style={{ fontSize: "1rem", color: "rgba(245,247,250,0.96)" }}>{item.label}</strong>
                          <span className="nt-text-xs nt-text-muted">{item.key}</span>
                        </div>
                        <NtBadge tone={toggles[item.key] ? "success" : "warning"}>
                          {toggles[item.key] ? "已外放" : "已隐藏"}
                        </NtBadge>
                      </div>
                      <p className="nt-text-sm nt-text-muted" style={{ margin: 0 }}>
                        {item.description}
                      </p>
                    </div>
                    <div className="nt-flex" style={{ gap: 8, flexWrap: "wrap" }}>
                      {item.impacts.map((impact) => (
                        <NtBadge key={impact} tone="glass">
                          {impact}
                        </NtBadge>
                      ))}
                    </div>
                    <label
                      className="nt-flex"
                      style={{
                        gap: 12,
                        alignItems: "center",
                        justifyContent: "space-between",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 18,
                        padding: "12px 14px",
                        background: "rgba(8,11,18,0.56)",
                      }}
                    >
                      <div className="nt-stack nt-gap-1">
                        <span className="nt-text-sm" style={{ color: "rgba(245,247,250,0.96)", fontWeight: 700 }}>
                          对普通访问者外放
                        </span>
                        <span className="nt-text-xs nt-text-muted">关闭后，普通用户和游客都不再看到这个入口。</span>
                      </div>
                      <input
                        checked={toggles[item.key]}
                        name={`surface:${item.key}`}
                        onChange={(event) =>
                          setToggles((current) => ({
                            ...current,
                            [item.key]: event.target.checked,
                          }))
                        }
                        style={{ width: 18, height: 18 }}
                        type="checkbox"
                      />
                    </label>
                  </NtCard>
                ))}
              </div>
            </section>
          ))}

          <div className="nt-flex" style={{ justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span
              className="nt-text-sm"
              style={{
                color:
                  state.status === "success"
                    ? "rgba(134,239,172,0.96)"
                    : state.status === "error"
                      ? "rgba(253,164,175,0.96)"
                      : "rgba(169,180,193,0.84)",
              }}
            >
              {state.message ?? "修改开关后点击保存，前台入口会按最新设置刷新。"}
            </span>
            <SaveButton />
          </div>
        </form>
      </div>
    </NtPanel>
  );
}
