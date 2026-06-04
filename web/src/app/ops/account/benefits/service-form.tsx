"use client";

import { useState } from "react";
import type { BenefitServiceView } from "@neuro/contracts";
import Link from "next/link";

import { saveBenefitServiceAction } from "./actions";

const SERVICE_ROLE_OPTIONS = [
  { value: "refill", label: "补号服务（续杯）" },
  { value: "api_proxy", label: "转发服务（调用）" },
];

const SERVICE_STATUS_OPTIONS = [
  { value: "draft", label: "草稿" },
  { value: "active", label: "启用" },
  { value: "archived", label: "归档" },
];

function inferServiceRole(service: BenefitServiceView): string {
  if (service.config.apiDeliveryMode === "service_proxy") return "api_proxy";
  return "refill";
}

type ServiceFormProps = {
  currentService: BenefitServiceView;
  isNewService: boolean;
  familyKey: string;
  productLineId: string | null;
  redirectTo: string;
};

export function ServiceForm({ currentService, isNewService, familyKey, productLineId, redirectTo }: ServiceFormProps) {
  const [role, setRole] = useState(() => isNewService ? "refill" : inferServiceRole(currentService));
  const isRefill = role === "refill";
  const isApiProxy = role === "api_proxy";

  // autoGenerateKey: default true for new, infer from config for existing
  const [autoGenerateKey, setAutoGenerateKey] = useState(() => {
    if (isNewService) return true;
    // Check if the config has a marker for auto key generation
    const config = currentService.config as Record<string, unknown>;
    return config.autoGenerateKey !== false;
  });

  return (
    <div className="ops-card" key={`svc-${currentService.id || "new"}-${role}`}>
      <h2 className="ops-card__title">{isNewService ? "新建服务" : `服务 · ${currentService.title}`}</h2>
      <form action={saveBenefitServiceAction} className="ops-form">
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <input name="serviceId" type="hidden" value={isNewService ? "" : currentService.id} />
        <input name="familyKey" type="hidden" value={familyKey} />
        <input name="serviceKind" type="hidden" value="credential_service_v1" />
        <input name="configTitle" type="hidden" value={currentService.title || currentService.config.title} />
        <input name="productLineId" type="hidden" value={productLineId ?? ""} />
        <input name="serviceRole" type="hidden" value={role} />
        <input name="autoGenerateKey" type="hidden" value={autoGenerateKey ? "true" : "false"} />

        {/* Row 1: Role + Title + Status */}
        <div className="ops-form__row">
          <label className="ops-form__label">
            服务角色 *
            <select
              className="ops-form__select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {SERVICE_ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="ops-form__label">
            服务标题 *
            <input className="ops-form__input" defaultValue={currentService.title} name="title" required placeholder={isRefill ? "无限续杯" : "无限调用"} />
          </label>
          <label className="ops-form__label">
            状态
            <select className="ops-form__select" defaultValue={currentService.status} name="status">
              {SERVICE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        {/* Row 2: Role-specific fields */}
        {isRefill ? (
          <div className="ops-form__row">
            <label className="ops-form__label">
              续杯 URL（用户下载客户端的地址）
              <input className="ops-form__input" defaultValue={currentService.config.downloadUrl ?? ""} name="downloadUrl" placeholder="https://example.com/download" />
            </label>
            <label className="ops-form__label">
              排序
              <input className="ops-form__input" defaultValue={String(currentService.sortOrder)} name="sortOrder" type="number" />
            </label>
            <label className="ops-form__label" style={{ display: "flex", alignItems: "flex-end" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
                <input defaultChecked={currentService.config.downloadEnabled} name="downloadEnabled" type="checkbox" />
                显示下载按钮
              </span>
            </label>
          </div>
        ) : null}

        {isApiProxy ? (
          <div className="ops-form__row">
            <label className="ops-form__label">
              API 访问地址（Relay URL）*
              <input className="ops-form__input" defaultValue={currentService.config.apiUrl} name="apiUrl" required placeholder="https://new-api.example.com/v1" />
            </label>
            <label className="ops-form__label">
              排序
              <input className="ops-form__input" defaultValue={String(currentService.sortOrder)} name="sortOrder" type="number" />
            </label>
          </div>
        ) : null}

        {/* Hidden defaults for fields not shown */}
        {isRefill ? <input name="apiUrl" type="hidden" value="" /> : null}
        {isApiProxy ? (
          <>
            <input name="downloadUrl" type="hidden" value="" />
            <input name="downloadEnabled" type="hidden" value="" />
          </>
        ) : null}

        {/* Row 3: Auto key generation switch */}
        <div className="ops-form__row">
          <label className="ops-form__label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              checked={autoGenerateKey}
              onChange={(e) => setAutoGenerateKey(e.target.checked)}
              type="checkbox"
            />
            自动生成密钥（{isRefill ? "续杯码由后台自动分配" : "API 密钥由后台自动签发"}）
          </label>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="ops-form__submit" type="submit">{isNewService ? "创建服务" : "保存服务"}</button>
          {!isNewService ? (
            <Link className="ops-inline-action" href={`/ops/account/credential-pools?serviceId=${encodeURIComponent(currentService.id)}`} style={{ alignSelf: "center" }}>
              前往凭证池
            </Link>
          ) : null}
        </div>
      </form>
    </div>
  );
}
