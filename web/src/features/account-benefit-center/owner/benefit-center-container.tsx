"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAppToast } from "@/components/app-toast-center";
import type {
  BenefitPanelView,
  BenefitServiceApiAccessView,
  BenefitServicePromptCacheSummaryView,
  BenefitServicePromptCacheTrendReportView,
  CredentialResolvedPayloadView,
} from "@/lib/account-client";
import { cn } from "@/lib/cn";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";

import {
  BENEFIT_CENTER_UNAVAILABLE_MESSAGE,
  BENEFIT_POLL_INTERVAL_MS,
  BENEFIT_SERVICE_SUMMARY_UNAVAILABLE_MESSAGE,
  BENEFIT_SERVICE_ROTATE_UNAVAILABLE_MESSAGE,
} from "../constants";
import { BenefitIcon, CloseIcon } from "../icons";
import {
  maskCredentialValue,
  sanitizeBenefitPanel,
  type BenefitPanelPayload,
  type SanitizedBenefitFamily,
  type SanitizedBenefitService,
  type ServiceDetailSummary,
} from "../utils";

function readResolvedPayloadString(payload: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!payload) {
    return null;
  }
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function buildServiceDetailSummary(
  service: SanitizedBenefitService,
  credential: CredentialResolvedPayloadView,
  apiAccess: BenefitServiceApiAccessView | null,
  promptCacheSummary: BenefitServicePromptCacheSummaryView | null,
  promptCacheTrendReport: BenefitServicePromptCacheTrendReportView | null,
): ServiceDetailSummary {
  const resolvedPayload = credential.payload;
  return {
    serviceId: service.id,
    serviceTitle: service.title,
    assignmentStatus: credential.lifecycleStatus === "available" ? "active" : service.assignmentStatus,
    providerKey: credential.providerKey,
    assignmentMode: credential.assignmentMode,
    credentialReady: Boolean(credential.payload),
    refillDeliveryMode: service.config.refillDeliveryMode,
    apiDeliveryMode: service.config.apiDeliveryMode,
    refillCode:
      service.config.refillDeliveryMode === "direct_credential"
        ? readResolvedPayloadString(resolvedPayload, ["refillCode", "refill_code", "code", "token"])
        : null,
    apiKey:
      service.config.apiDeliveryMode === "service_proxy"
        ? apiAccess?.apiKey ?? null
        : readResolvedPayloadString(resolvedPayload, ["apiKey", "api_key", "secret", "key"]),
    apiUrl:
    apiAccess?.apiUrl ??
      readResolvedPayloadString(resolvedPayload, ["apiUrl", "api_url", "endpoint", "url"]) ??
      service.credentialSummary?.apiUrl ??
      service.config.apiUrl,
    generatedAt: apiAccess?.issuedAt ?? credential.deliveredAt,
    promptCacheSummary,
    promptCacheTrendReport,
  };
}

function formatPromptCachePercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPromptCacheUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export type BenefitCenterProps = {
  enabled: boolean;
  routeOpen?: boolean;
  storeVisible?: boolean;
  userId: string | null;
};

type CredentialRotateIntent = "refill" | "api";

export function BenefitCenterContainer({
  enabled,
  routeOpen = false,
  storeVisible = true,
  userId,
}: BenefitCenterProps) {
  const router = useRouter();
  const { pushToast } = useAppToast();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);
  const panelErrorToastRef = useRef<string | null>(null);
  const titleId = useId();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [families, setFamilies] = useState<SanitizedBenefitFamily[]>([]);
  const [selectedFamilyKey, setSelectedFamilyKey] = useState<string | null>(null);
  const [summary, setSummary] = useState<BenefitPanelView["summary"] | null>(null);
  const [serviceDetailSummary, setServiceDetailSummary] = useState<ServiceDetailSummary | null>(null);
  const [serviceCredentialLoading, setServiceCredentialLoading] = useState(false);
  const [serviceCredentialError, setServiceCredentialError] = useState<string | null>(null);
  const [credentialRotateIntent, setCredentialRotateIntent] = useState<CredentialRotateIntent | null>(null);

  const selectedFamily = useMemo(
    () => families.find((family) => family.key === selectedFamilyKey) ?? families[0] ?? null,
    [families, selectedFamilyKey],
  );
  // Dual-service model: find refill service and API service independently within the family
  const refillService = useMemo(
    () => selectedFamily?.services.find((s) => s.config.apiDeliveryMode !== "service_proxy") ?? null,
    [selectedFamily],
  );
  const apiService = useMemo(
    () => selectedFamily?.services.find((s) => s.config.apiDeliveryMode === "service_proxy") ?? null,
    [selectedFamily],
  );
  // For backward compat: use whichever service exists for credential state checks
  const selectedArtificialIntelligenceService = refillService ?? apiService ?? null;

  async function refreshPanel() {
    if (!enabled || !userId) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/account-benefits/panel", {
        cache: "no-store",
      });
      const payload = (await response.json()) as BenefitPanelPayload;

      if (!response.ok || !payload.panel) {
        throw new Error(payload.error || BENEFIT_CENTER_UNAVAILABLE_MESSAGE);
      }

      const normalized = sanitizeBenefitPanel(payload.panel);
      setFamilies(normalized);
      setSummary(payload.panel.summary);
      setSelectedFamilyKey((current) =>
        normalized.some((family) => family.key === current)
          ? current
          : normalized?.[0]?.key ?? null,
      );
      panelErrorToastRef.current = null;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : BENEFIT_CENTER_UNAVAILABLE_MESSAGE;
      if (panelErrorToastRef.current !== message) {
        pushToast({
          tone: "error",
          title: "羊毛派",
          message,
        });
        panelErrorToastRef.current = message;
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchServiceDetailSummary(_unused?: SanitizedBenefitService | null) {
    setServiceCredentialError(null);
    setServiceCredentialLoading(true);

    try {
      // Sync refill service credential (if exists)
      let refillCredential: CredentialResolvedPayloadView | null = null;
      if (refillService) {
        const res = await fetch(`/api/account-credential-pools/services/${encodeURIComponent(refillService.id)}/credential`, {
          method: "POST",
          cache: "no-store",
        });
        const payload = (await res.json()) as { credential?: CredentialResolvedPayloadView; error?: string };
        if (res.ok && payload.credential) {
          refillCredential = payload.credential;
        }
      }

      // Sync API service access (if exists)
      let apiAccess: BenefitServiceApiAccessView | null = null;
      if (apiService) {
        const res = await fetch(`/api/account-benefits/services/${encodeURIComponent(apiService.id)}/api-access`, {
          method: "POST",
          cache: "no-store",
        });
        const payload = (await res.json()) as { access?: BenefitServiceApiAccessView; error?: string };
        if (res.ok && payload.access) {
          apiAccess = payload.access;
        }
      }

      let promptCacheSummary: BenefitServicePromptCacheSummaryView | null = null;
      let promptCacheTrendReport: BenefitServicePromptCacheTrendReportView | null = null;
      if (apiService) {
        const [summaryResponse, trendResponse] = await Promise.all([
          fetch(
            `/api/account-benefits/services/${encodeURIComponent(apiService.id)}/prompt-cache-summary`,
            {
              cache: "no-store",
            },
          ),
          fetch(
            `/api/account-benefits/services/${encodeURIComponent(apiService.id)}/prompt-cache-trend-report`,
            {
              cache: "no-store",
            },
          ),
        ]);
        const summaryPayload = (await summaryResponse.json()) as {
          summary?: BenefitServicePromptCacheSummaryView;
          error?: string;
        };
        if (summaryResponse.ok && summaryPayload.summary) {
          promptCacheSummary = summaryPayload.summary;
        }
        const trendPayload = (await trendResponse.json()) as {
          report?: BenefitServicePromptCacheTrendReportView;
          error?: string;
        };
        if (trendResponse.ok && trendPayload.report) {
          promptCacheTrendReport = trendPayload.report;
        }
      }

      // Build combined summary using refill service as primary (for credential fields)
      const primaryService = refillService ?? apiService;
      if (!primaryService) {
        throw new Error(BENEFIT_SERVICE_SUMMARY_UNAVAILABLE_MESSAGE);
      }

      setServiceDetailSummary(buildServiceDetailSummary(
        primaryService,
        refillCredential ?? ({} as CredentialResolvedPayloadView),
        apiAccess,
        promptCacheSummary,
        promptCacheTrendReport,
      ));
    } catch (error) {
      setServiceDetailSummary(null);
      setServiceCredentialError(
        error instanceof Error ? error.message : BENEFIT_SERVICE_SUMMARY_UNAVAILABLE_MESSAGE,
      );
    } finally {
      setServiceCredentialLoading(false);
    }
  }

  async function rotateServiceCredential(
    _unused: SanitizedBenefitService | null,
    intent: CredentialRotateIntent,
  ) {
    setServiceCredentialError(null);
    setCredentialRotateIntent(intent);

    try {
      if (intent === "refill") {
        const targetService = refillService;
        if (!targetService) throw new Error("未找到续杯服务");
        const response = await fetch(
          `/api/account-credential-pools/services/${encodeURIComponent(targetService.id)}/credential/rotate`,
          { method: "POST", cache: "no-store" },
        );
        const payload = (await response.json()) as { credential?: CredentialResolvedPayloadView; error?: string };
        if (!response.ok || !payload.credential) {
          throw new Error(payload.error || BENEFIT_SERVICE_ROTATE_UNAVAILABLE_MESSAGE);
        }
      } else {
        const targetService = apiService;
        if (!targetService) throw new Error("未找到调用服务");
        const response = await fetch(
          `/api/account-benefits/services/${encodeURIComponent(targetService.id)}/api-access/rotate`,
          { method: "POST", cache: "no-store" },
        );
        const payload = (await response.json()) as { access?: BenefitServiceApiAccessView; error?: string };
        if (!response.ok || !payload.access) {
          throw new Error(payload.error || BENEFIT_SERVICE_ROTATE_UNAVAILABLE_MESSAGE);
        }
      }

      await fetchServiceDetailSummary();
      await refreshPanel();
      pushToast({
        tone: "success",
        title: "羊毛派",
        message:
          intent === "refill"
            ? "续杯码已重置，旧账号凭证已退出发放链路。"
            : "API 密钥已重置，旧 new_api 密钥已失效。",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : BENEFIT_SERVICE_ROTATE_UNAVAILABLE_MESSAGE;
      setServiceCredentialError(message);
      pushToast({
        tone: "error",
        title: "羊毛派",
        message,
      });
    } finally {
      setCredentialRotateIntent(null);
    }
  }

  function handleClose() {
    if (routeOpen) {
      router.push("/dashboard");
      return;
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    let cancelled = false;

    async function syncPanel() {
      if (cancelled) {
        return;
      }
      await refreshPanel();
    }

    void syncPanel();
    const intervalId = window.setInterval(() => {
      void syncPanel();
    }, BENEFIT_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, userId]);

  useEffect(() => {
    if (!routeOpen || !enabled || !userId) {
      return;
    }

    setOpen(true);
    void refreshPanel();
  }, [enabled, routeOpen, userId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    return acquireBodyOverlayLock();
  }, [open]);

  useEffect(() => {
    if (selectedFamily?.key !== "artificial_intelligence") {
      setServiceDetailSummary(null);
      setServiceCredentialError(null);
      setServiceCredentialLoading(false);
    }
  }, [selectedFamily?.key]);

  useEffect(() => {
    setServiceDetailSummary(null);
    setServiceCredentialError(null);
    setServiceCredentialLoading(false);
    setCredentialRotateIntent(null);
  }, [selectedArtificialIntelligenceService?.id]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      closeButtonRef.current?.focus();
      return;
    }

    if (wasOpenRef.current) {
      triggerButtonRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setServiceDetailSummary(null);
      setServiceCredentialError(null);
      setServiceCredentialLoading(false);
      setCredentialRotateIntent(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, routeOpen]);

  if (!enabled || !userId) {
    return null;
  }

  const actionableFamilyCount = summary?.actionableFamilyCount ?? 0;
  const selectedCredentialSummary = selectedArtificialIntelligenceService?.credentialSummary ?? null;
  const hasFetchedServiceDetail = Boolean(serviceDetailSummary);
  const maskedRefillValue = serviceDetailSummary?.refillCode ? maskCredentialValue(serviceDetailSummary.refillCode) : null;
  const maskedApiKeyValue = serviceDetailSummary?.apiKey ? maskCredentialValue(serviceDetailSummary.apiKey) : null;
  const summaryTimestamp = serviceDetailSummary?.generatedAt
    ? new Date(serviceDetailSummary.generatedAt).toLocaleString()
    : null;
  const refillDisplay = serviceDetailSummary?.refillCode
    ? maskedRefillValue
    : serviceCredentialLoading
      ? "同步中…"
      : selectedArtificialIntelligenceService?.credentialReady
        ? "已分配，待同步"
        : "等待补位";
  const apiKeyDisplay = serviceDetailSummary?.apiKey
    ? maskedApiKeyValue
    : serviceCredentialLoading
      ? "同步中…"
      : selectedArtificialIntelligenceService?.config.apiDeliveryMode === "service_proxy"
        ? "待生成"
        : selectedArtificialIntelligenceService?.credentialReady
          ? "已分配，待同步"
          : "等待补位";
  const apiUrlDisplay =
    serviceDetailSummary?.apiUrl ??
    selectedCredentialSummary?.apiUrl ??
    selectedArtificialIntelligenceService?.config.apiUrl ??
    "等待配置";
  const promptCacheSummary = serviceDetailSummary?.promptCacheSummary?.summary ?? null;
  const promptCacheTrendReport = serviceDetailSummary?.promptCacheTrendReport?.report ?? null;
  const promptCacheWindowLabel =
    serviceDetailSummary?.promptCacheSummary?.windowStart && serviceDetailSummary?.promptCacheSummary?.windowEnd
      ? `${new Date(serviceDetailSummary.promptCacheSummary.windowStart).toLocaleDateString("zh-CN")} - ${new Date(
          serviceDetailSummary.promptCacheSummary.windowEnd,
        ).toLocaleDateString("zh-CN")}`
      : null;
  const promptCacheTrendPoints = (promptCacheTrendReport?.points ?? []).slice(-7).reverse();
  // credentialStateLabel and credentialStateHint removed — no longer displayed in the panel

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "app-benefit-trigger",
          actionableFamilyCount > 0 && "app-benefit-trigger--ready",
        )}
        onClick={() => {
          setOpen(true);
          void refreshPanel();
        }}
        ref={triggerButtonRef}
        type="button"
      >
        <span className="app-benefit-trigger__copy">
          <BenefitIcon />
          <span>羊毛派</span>
        </span>
      </button>

      {open ? (
        <div aria-labelledby={titleId} aria-modal="true" className="app-benefit-overlay" role="dialog">
          <button
            aria-label="关闭羊毛派面板"
            className="app-benefit-backdrop"
            onClick={handleClose}
            type="button"
          />

          <section className="app-benefit-center">
            <aside className="app-benefit-center__rail">
              <div className="app-benefit-center__rail-head">
                <div className="app-benefit-center__rail-mark" aria-hidden="true">
                  <BenefitIcon />
                </div>
                <div className="app-benefit-center__rail-copy">
                  <h2 className="app-benefit-center__rail-title" id={titleId}>羊毛派</h2>
                </div>
              </div>

              <div className="app-benefit-center__rail-list">
                {loading && families.length === 0 ? (
                  <p className="app-benefit-center__empty-note">权益加载中…</p>
                ) : null}

                {!loading && families.length === 0 ? (
                  <p className="app-benefit-center__empty-note">当前还没有可展示的已购权益。</p>
                ) : null}

                {families.map((family) => (
                  <button
                    className={cn(
                      "app-benefit-center__rail-item",
                      selectedFamily?.key === family.key && "app-benefit-center__rail-item--active",
                    )}
                    key={family.key}
                    onClick={() => setSelectedFamilyKey(family.key)}
                    type="button"
                  >
                    <div className="app-benefit-center__rail-item-copy">
                      <strong>{family.title}</strong>
                    </div>
                  </button>
                ))}
              </div>

            </aside>

            <article className="app-benefit-center__content">
              <button
                aria-label="关闭羊毛派面板"
                className="app-benefit-close"
                onClick={handleClose}
                ref={closeButtonRef}
                type="button"
              >
                <CloseIcon />
              </button>

              {selectedFamily ? (
                <>
                  <header className={`app-benefit-center__hero app-benefit-center__hero--${selectedFamily.tone}`}>
                    <div className="app-benefit-center__hero-copy">
                      <strong>{selectedFamily.title}</strong>
                    </div>
                  </header>

                  <div className="app-benefit-center__body">
                    {selectedFamily.key === "artificial_intelligence" ? (
                      <section className="app-benefit-ai">
                        {selectedArtificialIntelligenceService ? (
                          <section className="app-benefit-ai__panel" aria-label={selectedFamily.productLines?.[0]?.displayName ?? selectedArtificialIntelligenceService.title}>
                            <div className="app-benefit-ai__service-title">
                              <strong>{selectedFamily.productLines?.[0]?.displayName ?? "Codex"}</strong>
                            </div>

                            <div className="app-benefit-ai__matrix">
                              {serviceCredentialError ? (
                                <p className="app-benefit-ai__summary-error">{serviceCredentialError}</p>
                              ) : null}
                              {/* 续杯行 — 数据来自 refillService */}
                              {refillService ? (
                                <div className={`app-benefit-ai__row app-benefit-ai__row--refill ${!refillService.granted ? "app-benefit-ai__row--locked" : ""}`}>
                                  <div className="app-benefit-ai__slot app-benefit-ai__slot--mode">
                                    <strong>{refillService.config.refillModeText || "无限续杯"}</strong>
                                    {!refillService.granted ? <span className="app-benefit-ai__locked-hint">购买后可用</span> : null}
                                    {refillService.granted && refillService.grantExpiresAt ? <span className="app-benefit-ai__expiry-hint">有效至 {new Date(refillService.grantExpiresAt).toLocaleDateString("zh-CN")}</span> : null}
                                  </div>
                                  <div className="app-benefit-ai__slot app-benefit-ai__slot--compact">
                                    <span>{refillService.config.availabilityLabel || "可用账号数"}</span>
                                    <strong>{refillService.granted ? (refillService.config.availabilityText || "—") : "—"}</strong>
                                  </div>
                                  <div className="app-benefit-ai__slot">
                                    <span>访问地址</span>
                                    <strong>{refillService.downloadUrl || "等待配置"}</strong>
                                  </div>
                                  <div className="app-benefit-ai__slot app-benefit-ai__slot--secret">
                                    <span>续杯码</span>
                                    <strong>{refillService.granted ? refillDisplay : "购买后显示"}</strong>
                                  </div>
                                  <div className="app-benefit-ai__slot app-benefit-ai__slot--inline-action">
                                    <button
                                      className="app-benefit-ai__action-btn"
                                      disabled={!refillService.granted || serviceCredentialLoading || credentialRotateIntent !== null || !refillService.credentialReady}
                                      onClick={() => rotateServiceCredential(null, "refill")}
                                      type="button"
                                    >
                                      {credentialRotateIntent === "refill" ? "重置中…" : "重置刷新"}
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {/* 调用行 — 数据来自 apiService */}
                              {apiService ? (
                                <div className={`app-benefit-ai__row app-benefit-ai__row--api ${!apiService.granted ? "app-benefit-ai__row--locked" : ""}`}>
                                  <div className="app-benefit-ai__slot app-benefit-ai__slot--mode">
                                    <strong>{apiService.config.apiModeText || "无限调用"}</strong>
                                    {!apiService.granted ? <span className="app-benefit-ai__locked-hint">购买后可用</span> : null}
                                    {apiService.granted && apiService.grantExpiresAt ? <span className="app-benefit-ai__expiry-hint">有效至 {new Date(apiService.grantExpiresAt).toLocaleDateString("zh-CN")}</span> : null}
                                  </div>
                                  <div className="app-benefit-ai__slot">
                                    <span>API 访问地址</span>
                                    <strong>{apiService.granted ? apiUrlDisplay : "购买后显示"}</strong>
                                  </div>
                                  <div className="app-benefit-ai__slot app-benefit-ai__slot--secret">
                                    <span>API 密钥</span>
                                    <strong>{apiService.granted ? apiKeyDisplay : "购买后显示"}</strong>
                                  </div>
                                  <div className="app-benefit-ai__slot app-benefit-ai__slot--inline-action">
                                    <button
                                      className="app-benefit-ai__action-btn"
                                      disabled={!apiService.granted || serviceCredentialLoading || credentialRotateIntent !== null}
                                      onClick={() => rotateServiceCredential(null, "api")}
                                      type="button"
                                    >
                                      {credentialRotateIntent === "api" ? "重置中…" : "重置刷新"}
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {apiService?.granted ? (
                                <div className="app-benefit-ai__prompt-cache">
                                  <div className="app-benefit-ai__prompt-cache-head">
                                    <strong>Prompt Cache 收益</strong>
                                    <span>{promptCacheWindowLabel ?? "近 30 天"}</span>
                                  </div>
                                  {promptCacheSummary ? (
                                    <div className="app-benefit-ai__prompt-cache-grid">
                                      <div className="app-benefit-ai__prompt-cache-card">
                                        <span>命中率</span>
                                        <strong>{(promptCacheSummary.cacheHitRate * 100).toFixed(1)}%</strong>
                                      </div>
                                      <div className="app-benefit-ai__prompt-cache-card">
                                        <span>覆盖率</span>
                                        <strong>{(promptCacheSummary.cacheControlCoverageRate * 100).toFixed(1)}%</strong>
                                      </div>
                                      <div className="app-benefit-ai__prompt-cache-card">
                                        <span>读缓存 Token</span>
                                        <strong>{promptCacheSummary.totalTokensSaved.toLocaleString("zh-CN")}</strong>
                                      </div>
                                      <div className="app-benefit-ai__prompt-cache-card">
                                        <span>估算节省</span>
                                        <strong>${promptCacheSummary.estimatedCostSavedUsd.toFixed(2)}</strong>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="app-benefit-ai__prompt-cache-empty">
                                      当前时间窗内还没有可统计的 Claude Prompt Cache 样本。
                                    </p>
                                  )}
                                  <div className="app-benefit-ai__prompt-cache-trend">
                                    <div className="app-benefit-ai__prompt-cache-head">
                                      <strong>近期走势</strong>
                                      <span>
                                        {promptCacheTrendReport?.bucketSize === "hour" ? "按小时" : "按天"} · 最近 {promptCacheTrendPoints.length || 0} 桶
                                      </span>
                                    </div>
                                    {promptCacheTrendPoints.length > 0 ? (
                                      <div className="app-benefit-ai__prompt-cache-trend-grid">
                                        {promptCacheTrendPoints.map((point) => (
                                          <div className="app-benefit-ai__prompt-cache-trend-card" key={point.bucketStart}>
                                            <div className="app-benefit-ai__prompt-cache-trend-date">
                                              {new Date(point.bucketStart).toLocaleDateString("zh-CN", {
                                                month: "2-digit",
                                                day: "2-digit",
                                              })}
                                            </div>
                                            <div className="app-benefit-ai__prompt-cache-trend-metrics">
                                              <span>请求 {point.totalRequests.toLocaleString("zh-CN")}</span>
                                              <span>命中 {formatPromptCachePercent(point.cacheHitRate)}</span>
                                              <span>覆盖 {formatPromptCachePercent(point.cacheControlCoverageRate)}</span>
                                              <span>节省 {formatPromptCacheUsd(point.estimatedCostSavedUsd)}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="app-benefit-ai__prompt-cache-empty">
                                        当前时间窗内还没有可展示的走势样本。
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </section>
                        ) : (
                          <p className="app-benefit-center__empty-note">当前分类还没有可领取的服务。</p>
                        )}
                      </section>
                    ) : (
                      <div className="app-benefit-center__empty">
                        <strong>{selectedFamily.title}</strong>
                        <p>当前分类暂无可领取权益。完成购买并发放后，你的权益会在这里统一展示和管理。</p>
                        <p className="app-benefit-center__empty-hint">
                          如有疑问，请在站内邮箱联系运营团队。
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="app-benefit-center__empty">
                  <strong>当前还没有已购权益</strong>
                  <p>当商品完成购买并发放后，它会在这里按权益族合并展示。</p>
                  {storeVisible ? (
                    <Link className="mg-btn mg-btn--primary" href="/products" onClick={() => setOpen(false)}>
                      前往商品页
                    </Link>
                  ) : null}
                </div>
              )}
            </article>
          </section>
        </div>
      ) : null}
    </>
  );
}
