"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  resolveBenefitFamilySelection,
  resolveBenefitServiceDependency,
  resolveBenefitServiceSelection,
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
  refillService: SanitizedBenefitService | null,
  apiService: SanitizedBenefitService | null,
  credential: CredentialResolvedPayloadView | null,
  apiAccess: BenefitServiceApiAccessView | null,
  promptCacheSummary: BenefitServicePromptCacheSummaryView | null,
  promptCacheTrendReport: BenefitServicePromptCacheTrendReportView | null,
): ServiceDetailSummary {
  const resolvedPayload = credential?.payload;
  const primaryCredential = service.id === refillService?.id ? credential : null;
  return {
    serviceId: service.id,
    serviceTitle: service.title,
    assignmentStatus: primaryCredential?.lifecycleStatus === "available" ? "active" : service.assignmentStatus,
    providerKey: primaryCredential?.providerKey ?? service.providerKey,
    assignmentMode: primaryCredential?.assignmentMode ?? service.assignmentMode,
    credentialReady: Boolean(primaryCredential?.payload) || service.credentialReady,
    refillDeliveryMode: refillService?.config.refillDeliveryMode ?? service.config.refillDeliveryMode,
    apiDeliveryMode: apiService?.config.apiDeliveryMode ?? service.config.apiDeliveryMode,
    refillCode:
      refillService?.config.refillDeliveryMode === "direct_credential"
        ? readResolvedPayloadString(resolvedPayload, ["refillCode", "refill_code", "code", "token"])
        : null,
    apiKey:
      apiService?.config.apiDeliveryMode === "service_proxy"
        ? apiAccess?.apiKey ?? null
        : readResolvedPayloadString(resolvedPayload, ["apiKey", "api_key", "secret", "key"]),
    apiUrl:
      apiAccess?.apiUrl ??
      readResolvedPayloadString(resolvedPayload, ["apiUrl", "api_url", "endpoint", "url"]) ??
      apiService?.credentialSummary?.apiUrl ??
      apiService?.config.apiUrl ??
      service.credentialSummary?.apiUrl ??
      service.config.apiUrl,
    generatedAt:
      (service.id === apiService?.id ? apiAccess?.issuedAt : primaryCredential?.deliveredAt) ??
      service.credentialSummary?.updatedAt ??
      "",
    promptCacheSummary,
    promptCacheTrendReport,
  };
}

async function loadBenefitServiceDependency<T>(args: {
  request: () => Promise<Response>;
  readValue: (payload: Record<string, unknown>) => T | null | undefined;
  fallbackMessage: string;
}) {
  try {
    const response = await args.request();
    const payload = (await response.json()) as Record<string, unknown>;
    return resolveBenefitServiceDependency({
      ok: response.ok,
      value: args.readValue(payload),
      error: typeof payload.error === "string" ? payload.error : null,
      fallbackMessage: args.fallbackMessage,
    });
  } catch {
    return resolveBenefitServiceDependency<T>({
      ok: false,
      value: null,
      fallbackMessage: args.fallbackMessage,
    });
  }
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
  displayMode?: "overlay" | "workspace";
  routeOpen?: boolean;
  storeVisible?: boolean;
  userId: string | null;
};

type CredentialRotateIntent = "refill" | "api";

type BenefitPanelState = {
  families: SanitizedBenefitFamily[];
  summary: BenefitPanelView["summary"];
  userId: string;
};

type ServiceDetailState = {
  summary: ServiceDetailSummary;
  userId: string;
};

const EMPTY_BENEFIT_FAMILIES: SanitizedBenefitFamily[] = [];

export function BenefitCenterContainer({
  enabled,
  displayMode = "overlay",
  routeOpen = false,
  storeVisible = true,
  userId,
}: BenefitCenterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useAppToast();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);
  const panelErrorToastRef = useRef<string | null>(null);
  const panelRequestIdRef = useRef(0);
  const panelRequestRef = useRef<{ controller: AbortController; id: number } | null>(null);
  const serviceDetailRequestIdRef = useRef(0);
  const serviceDetailRequestRef = useRef<{ controller: AbortController; id: number } | null>(null);
  const activeUserIdRef = useRef(userId);
  const selectedServiceIdRef = useRef<string | null>(null);
  const targetedFamilyKeyRef = useRef<string | null>(null);
  const targetedServiceIdRef = useRef<string | null>(null);
  const titleId = useId();

  const workspace = displayMode === "workspace";
  const [open, setOpen] = useState(workspace);
  const [loading, setLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelState, setPanelState] = useState<BenefitPanelState | null>(null);
  const [selectedFamilyKey, setSelectedFamilyKey] = useState<string | null>(null);
  const [serviceDetailState, setServiceDetailState] = useState<ServiceDetailState | null>(null);
  const [serviceCredentialLoading, setServiceCredentialLoading] = useState(false);
  const [serviceCredentialError, setServiceCredentialError] = useState<string | null>(null);
  const [credentialRotateIntent, setCredentialRotateIntent] = useState<CredentialRotateIntent | null>(null);
  const families = panelState?.userId === userId ? panelState.families : EMPTY_BENEFIT_FAMILIES;
  const summary = panelState?.userId === userId ? panelState.summary : null;
  const serviceDetailSummary = serviceDetailState?.userId === userId ? serviceDetailState.summary : null;
  activeUserIdRef.current = userId;

  const selectedFamily = useMemo(
    () => families.find((family) => family.key === selectedFamilyKey) ?? families[0] ?? null,
    [families, selectedFamilyKey],
  );
  const targetedFamilyKey = searchParams?.get("family")?.trim() || null;
  const targetedServiceId = searchParams?.get("serviceId")?.trim() || null;
  targetedFamilyKeyRef.current = targetedFamilyKey;
  targetedServiceIdRef.current = targetedServiceId;
  const serviceSelection = useMemo(
    () => resolveBenefitServiceSelection(selectedFamily?.services ?? [], targetedServiceId),
    [selectedFamily, targetedServiceId],
  );
  const { targetedService, refillService, apiService } = serviceSelection;
  const selectedArtificialIntelligenceService = targetedService ?? refillService ?? apiService;
  selectedServiceIdRef.current = selectedArtificialIntelligenceService?.id ?? null;

  async function refreshPanel() {
    if (!enabled || !userId) {
      return;
    }

    const requestUserId = userId;
    panelRequestRef.current?.controller.abort();
    const requestId = panelRequestIdRef.current + 1;
    panelRequestIdRef.current = requestId;
    const controller = new AbortController();
    panelRequestRef.current = { controller, id: requestId };
    setLoading(true);
    try {
      const response = await fetch("/api/account-benefits/panel", {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as BenefitPanelPayload;

      if (!response.ok || !payload.panel) {
        throw new Error(payload.error || BENEFIT_CENTER_UNAVAILABLE_MESSAGE);
      }

      if (
        controller.signal.aborted ||
        panelRequestIdRef.current !== requestId ||
        activeUserIdRef.current !== requestUserId
      ) {
        return;
      }
      const normalized = sanitizeBenefitPanel(payload.panel);
      setPanelState({ families: normalized, summary: payload.panel.summary, userId: requestUserId });
      setSelectedFamilyKey((current) =>
        resolveBenefitFamilySelection(
          normalized,
          current,
          targetedFamilyKeyRef.current,
          targetedServiceIdRef.current,
        ),
      );
      setPanelError(null);
      panelErrorToastRef.current = null;
    } catch (error) {
      if (
        controller.signal.aborted ||
        panelRequestIdRef.current !== requestId ||
        activeUserIdRef.current !== requestUserId
      ) {
        return;
      }
      const message =
        error instanceof Error ? error.message : BENEFIT_CENTER_UNAVAILABLE_MESSAGE;
      setPanelError(message);
      if (panelErrorToastRef.current !== message) {
        pushToast({
          tone: "error",
          title: "羊毛派",
          message,
        });
        panelErrorToastRef.current = message;
      }
    } finally {
      if (panelRequestRef.current?.id === requestId) {
        panelRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  async function fetchServiceDetailSummary() {
    if (!userId) {
      return;
    }
    const primaryService = targetedService ?? refillService ?? apiService;
    if (!primaryService) {
      setServiceCredentialError(BENEFIT_SERVICE_SUMMARY_UNAVAILABLE_MESSAGE);
      return;
    }

    const requestUserId = userId;
    const requestServiceId = primaryService.id;
    serviceDetailRequestRef.current?.controller.abort();
    const requestId = serviceDetailRequestIdRef.current + 1;
    serviceDetailRequestIdRef.current = requestId;
    const controller = new AbortController();
    serviceDetailRequestRef.current = { controller, id: requestId };
    setServiceCredentialError(null);
    setServiceCredentialLoading(true);

    try {
      const unavailableDependency = <T,>() => Promise.resolve({ data: null as T | null, error: null as string | null });
      const [refillCredentialResult, apiAccessResult, promptCacheSummaryResult, promptCacheTrendResult] =
        await Promise.all([
          refillService
            ? loadBenefitServiceDependency<CredentialResolvedPayloadView>({
                request: () =>
                  fetch(`/api/account-credential-pools/services/${encodeURIComponent(refillService.id)}/credential`, {
                    method: "POST",
                    cache: "no-store",
                    signal: controller.signal,
                  }),
                readValue: (payload) => payload.credential as CredentialResolvedPayloadView | undefined,
                fallbackMessage: "续杯凭证暂不可用。",
              })
            : unavailableDependency<CredentialResolvedPayloadView>(),
          apiService
            ? loadBenefitServiceDependency<BenefitServiceApiAccessView>({
                request: () =>
                  fetch(`/api/account-benefits/services/${encodeURIComponent(apiService.id)}/api-access`, {
                    method: "POST",
                    cache: "no-store",
                    signal: controller.signal,
                  }),
                readValue: (payload) => payload.access as BenefitServiceApiAccessView | undefined,
                fallbackMessage: "API 访问信息暂不可用。",
              })
            : unavailableDependency<BenefitServiceApiAccessView>(),
          apiService
            ? loadBenefitServiceDependency<BenefitServicePromptCacheSummaryView>({
                request: () =>
                  fetch(`/api/account-benefits/services/${encodeURIComponent(apiService.id)}/prompt-cache-summary`, {
                    cache: "no-store",
                    signal: controller.signal,
                  }),
                readValue: (payload) => payload.summary as BenefitServicePromptCacheSummaryView | undefined,
                fallbackMessage: "Prompt Cache 摘要暂不可用。",
              })
            : unavailableDependency<BenefitServicePromptCacheSummaryView>(),
          apiService
            ? loadBenefitServiceDependency<BenefitServicePromptCacheTrendReportView>({
                request: () =>
                  fetch(`/api/account-benefits/services/${encodeURIComponent(apiService.id)}/prompt-cache-trend-report`, {
                    cache: "no-store",
                    signal: controller.signal,
                  }),
                readValue: (payload) => payload.report as BenefitServicePromptCacheTrendReportView | undefined,
                fallbackMessage: "Prompt Cache 走势暂不可用。",
              })
            : unavailableDependency<BenefitServicePromptCacheTrendReportView>(),
        ]);

      const dependencyErrors = [
        refillCredentialResult.error ? `续杯凭证：${refillCredentialResult.error}` : null,
        apiAccessResult.error ? `API 访问：${apiAccessResult.error}` : null,
        promptCacheSummaryResult.error ? `Prompt Cache 摘要：${promptCacheSummaryResult.error}` : null,
        promptCacheTrendResult.error ? `Prompt Cache 走势：${promptCacheTrendResult.error}` : null,
      ].filter((message): message is string => Boolean(message));

      if (
        controller.signal.aborted ||
        serviceDetailRequestIdRef.current !== requestId ||
        activeUserIdRef.current !== requestUserId ||
        selectedServiceIdRef.current !== requestServiceId
      ) {
        return;
      }

      setServiceDetailState({
        summary: buildServiceDetailSummary(
          primaryService,
          refillService,
          apiService,
          refillCredentialResult.data,
          apiAccessResult.data,
          promptCacheSummaryResult.data,
          promptCacheTrendResult.data,
        ),
        userId: requestUserId,
      });
      setServiceCredentialError(dependencyErrors.length > 0 ? dependencyErrors.join("；") : null);
    } catch (error) {
      if (
        controller.signal.aborted ||
        serviceDetailRequestIdRef.current !== requestId ||
        activeUserIdRef.current !== requestUserId ||
        selectedServiceIdRef.current !== requestServiceId
      ) {
        return;
      }
      setServiceDetailState(null);
      setServiceCredentialError(
        error instanceof Error ? error.message : BENEFIT_SERVICE_SUMMARY_UNAVAILABLE_MESSAGE,
      );
    } finally {
      if (serviceDetailRequestRef.current?.id === requestId) {
        serviceDetailRequestRef.current = null;
        setServiceCredentialLoading(false);
      }
    }
  }

  function clearServiceDetailState() {
    serviceDetailRequestRef.current?.controller.abort();
    serviceDetailRequestRef.current = null;
    serviceDetailRequestIdRef.current += 1;
    setServiceDetailState(null);
    setServiceCredentialError(null);
    setServiceCredentialLoading(false);
    setCredentialRotateIntent(null);
  }

  async function rotateServiceCredential(
    _unused: SanitizedBenefitService | null,
    intent: CredentialRotateIntent,
  ) {
    if (!userId) {
      return;
    }
    const requestUserId = userId;
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
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }

      await fetchServiceDetailSummary();
      await refreshPanel();
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }
      pushToast({
        tone: "success",
        title: "羊毛派",
        message:
          intent === "refill"
            ? "续杯码已重置，旧账号凭证已退出发放链路。"
            : "API 密钥已重置，旧 new_api 密钥已失效。",
      });
    } catch (error) {
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }
      const message =
        error instanceof Error ? error.message : BENEFIT_SERVICE_ROTATE_UNAVAILABLE_MESSAGE;
      setServiceCredentialError(message);
      pushToast({
        tone: "error",
        title: "羊毛派",
        message,
      });
    } finally {
      if (activeUserIdRef.current === requestUserId) {
        setCredentialRotateIntent(null);
      }
    }
  }

  function handleClose() {
    if (workspace) {
      return;
    }
    if (routeOpen) {
      router.push("/dashboard");
      return;
    }
    setOpen(false);
  }

  function handleSelectFamily(family: SanitizedBenefitFamily) {
    setSelectedFamilyKey(family.key);
    if (!workspace) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("family", family.key);
    if (targetedServiceId && !family.services.some((service) => service.id === targetedServiceId)) {
      params.delete("serviceId");
    }
    const query = params.toString();
    router.replace(query ? `/benefits?${query}` : "/benefits", { scroll: false });
  }

  useEffect(() => {
    setPanelState(null);
    setPanelError(null);
    setLoading(false);
    setSelectedFamilyKey(null);
    clearServiceDetailState();
    panelErrorToastRef.current = null;
  }, [userId]);

  useEffect(() => {
    const nextFamilyKey = resolveBenefitFamilySelection(
      families,
      selectedFamilyKey,
      targetedFamilyKey,
      targetedServiceId,
    );
    if (nextFamilyKey && nextFamilyKey !== selectedFamilyKey) {
      setSelectedFamilyKey(nextFamilyKey);
    }
  }, [families, selectedFamilyKey, targetedFamilyKey, targetedServiceId]);

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    let cancelled = false;

    async function syncPanel() {
      if (cancelled || panelRequestRef.current) {
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
      panelRequestRef.current?.controller.abort();
      panelRequestRef.current = null;
      panelRequestIdRef.current += 1;
    };
  }, [enabled, userId]);

  useEffect(() => {
    if ((!routeOpen && !workspace) || !enabled || !userId) {
      return;
    }

    setOpen(true);
  }, [enabled, routeOpen, userId, workspace]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (workspace) {
      return;
    }
    return acquireBodyOverlayLock();
  }, [open, workspace]);

  useEffect(() => {
    if (selectedFamily?.key !== "artificial_intelligence") {
      clearServiceDetailState();
    }
  }, [selectedFamily?.key]);

  useEffect(() => {
    clearServiceDetailState();
  }, [selectedArtificialIntelligenceService?.id]);

  useEffect(() => {
    if (open && !workspace) {
      wasOpenRef.current = true;
      closeButtonRef.current?.focus();
      return;
    }

    if (wasOpenRef.current) {
      triggerButtonRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [open, workspace]);

  useEffect(() => {
    if (!open) {
      clearServiceDetailState();
    }
  }, [open]);

  useEffect(() => {
    if (!open || workspace) {
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
  }, [open, routeOpen, workspace]);

  if (!enabled || !userId) {
    return null;
  }

  const actionableFamilyCount = summary?.actionableFamilyCount ?? 0;
  const currentServiceDetailSummary =
    serviceDetailSummary?.serviceId === selectedArtificialIntelligenceService?.id ? serviceDetailSummary : null;
  const maskedRefillValue = currentServiceDetailSummary?.refillCode ? maskCredentialValue(currentServiceDetailSummary.refillCode) : null;
  const maskedApiKeyValue = currentServiceDetailSummary?.apiKey ? maskCredentialValue(currentServiceDetailSummary.apiKey) : null;
  const summaryTimestamp = currentServiceDetailSummary?.generatedAt
    ? new Date(currentServiceDetailSummary.generatedAt).toLocaleString()
    : null;
  const refillDisplay = currentServiceDetailSummary?.refillCode
    ? maskedRefillValue
    : serviceCredentialLoading
      ? "同步中…"
      : refillService?.credentialReady
        ? "已分配，待同步"
        : "等待补位";
  const apiKeyDisplay = currentServiceDetailSummary?.apiKey
    ? maskedApiKeyValue
    : serviceCredentialLoading
      ? "同步中…"
      : apiService?.config.apiDeliveryMode === "service_proxy"
        ? "待生成"
        : apiService?.credentialReady
          ? "已分配，待同步"
          : "等待补位";
  const apiUrlDisplay =
    currentServiceDetailSummary?.apiUrl ??
    apiService?.credentialSummary?.apiUrl ??
    apiService?.config.apiUrl ??
    "等待配置";
  const promptCacheSummary = currentServiceDetailSummary?.promptCacheSummary?.summary ?? null;
  const promptCacheTrendReport = currentServiceDetailSummary?.promptCacheTrendReport?.report ?? null;
  const promptCacheWindowLabel =
    currentServiceDetailSummary?.promptCacheSummary?.windowStart && currentServiceDetailSummary?.promptCacheSummary?.windowEnd
      ? `${new Date(currentServiceDetailSummary.promptCacheSummary.windowStart).toLocaleDateString("zh-CN")} - ${new Date(
          currentServiceDetailSummary.promptCacheSummary.windowEnd,
        ).toLocaleDateString("zh-CN")}`
      : null;
  const promptCacheTrendPoints = (promptCacheTrendReport?.points ?? []).slice(-7).reverse();
  const promptCacheSummaryUnavailable = Boolean(serviceCredentialError?.includes("Prompt Cache 摘要"));
  const promptCacheTrendUnavailable = Boolean(serviceCredentialError?.includes("Prompt Cache 走势"));
  // credentialStateLabel and credentialStateHint removed — no longer displayed in the panel

  return (
    <>
      {!workspace ? <button
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
      </button> : null}

      <div className={workspace ? "app-benefit-workspace" : "app-benefit-overlay-host"}>
      {workspace || open ? (
        <div
          aria-labelledby={titleId}
          aria-modal={workspace ? undefined : true}
          className={workspace ? undefined : "app-benefit-overlay"}
          role={workspace ? "region" : "dialog"}
        >
          {!workspace ? <button
            aria-label="关闭羊毛派面板"
            className="app-benefit-backdrop"
            onClick={handleClose}
            type="button"
          /> : null}

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

                {!loading && !panelError && families.length === 0 ? (
                  <p className="app-benefit-center__empty-note">当前还没有可展示的已购权益。</p>
                ) : null}

                {families.map((family) => (
                  <button
                    className={cn(
                      "app-benefit-center__rail-item",
                      selectedFamily?.key === family.key && "app-benefit-center__rail-item--active",
                    )}
                    key={family.key}
                    onClick={() => handleSelectFamily(family)}
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
              {!workspace ? <button
                aria-label="关闭羊毛派面板"
                className="app-benefit-close"
                onClick={handleClose}
                ref={closeButtonRef}
                type="button"
              >
                <CloseIcon />
              </button> : null}

              {panelError ? <p className="app-benefit-center__error" role="alert">{panelError}</p> : null}
              {selectedFamily ? (
                <>
                  <header className={`app-benefit-center__hero app-benefit-center__hero--${selectedFamily.tone}`}>
                    <div className="app-benefit-center__hero-copy">
                      <strong>{selectedFamily.title}</strong>
                      {targetedService ? <span>当前服务：{targetedService.title}</span> : null}
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
                                <div
                                  className={`app-benefit-ai__row app-benefit-ai__row--refill ${!refillService.granted ? "app-benefit-ai__row--locked" : ""}`}
                                  data-deep-link-target={targetedService?.id === refillService.id ? "true" : undefined}
                                  data-service-id={refillService.id}
                                >
                                  <div className="app-benefit-ai__slot app-benefit-ai__slot--mode">
                                    <strong>{refillService.config.refillModeText || "无限续杯"}</strong>
                                    {targetedService?.id === refillService.id ? <span>已选择</span> : null}
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
                                <div
                                  className={`app-benefit-ai__row app-benefit-ai__row--api ${!apiService.granted ? "app-benefit-ai__row--locked" : ""}`}
                                  data-deep-link-target={targetedService?.id === apiService.id ? "true" : undefined}
                                  data-service-id={apiService.id}
                                >
                                  <div className="app-benefit-ai__slot app-benefit-ai__slot--mode">
                                    <strong>{apiService.config.apiModeText || "无限调用"}</strong>
                                    {targetedService?.id === apiService.id ? <span>已选择</span> : null}
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
                                  ) : promptCacheSummaryUnavailable ? (
                                    <p className="app-benefit-ai__summary-error">Prompt Cache 摘要暂不可用。</p>
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
                                    ) : promptCacheTrendUnavailable ? (
                                      <p className="app-benefit-ai__summary-error">Prompt Cache 走势暂不可用。</p>
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
              ) : !panelError ? (
                <div className="app-benefit-center__empty">
                  <strong>当前还没有已购权益</strong>
                  <p>当商品完成购买并发放后，它会在这里按权益族合并展示。</p>
                  {storeVisible ? (
                    <Link className="mg-btn mg-btn--primary" href="/products" onClick={() => setOpen(false)}>
                      前往商品页
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </article>
          </section>
        </div>
      ) : null}
      </div>
    </>
  );
}
