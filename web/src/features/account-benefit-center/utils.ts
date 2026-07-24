import type {
  BenefitAssignmentStatus,
  BenefitApiDeliveryMode,
  BenefitCredentialServiceConfig,
  BenefitFamilyKey,
  BenefitPanelFamilyView,
  BenefitPanelView,
  BenefitRefillDeliveryMode,
  BenefitServicePromptCacheSummaryView,
  BenefitServicePromptCacheTrendReportView,
  BenefitServiceStatus,
  CredentialAssignmentMode,
  CredentialAssignmentSummaryView,
  CredentialProviderKey,
} from "@/lib/account-client";

export type BenefitPanelPayload = {
  error?: string;
  panel?: BenefitPanelView;
};

export type ServiceDetailSummary = {
  serviceId: string;
  serviceTitle: string;
  assignmentStatus: BenefitAssignmentStatus;
  providerKey: CredentialProviderKey;
  assignmentMode: CredentialAssignmentMode;
  credentialReady: boolean;
  refillDeliveryMode: BenefitRefillDeliveryMode;
  apiDeliveryMode: BenefitApiDeliveryMode;
  refillCode: string | null;
  apiKey: string | null;
  apiUrl: string | null;
  generatedAt: string;
  promptCacheSummary: BenefitServicePromptCacheSummaryView | null;
  promptCacheTrendReport: BenefitServicePromptCacheTrendReportView | null;
};

export type SanitizedBenefitService = {
  id: string;
  title: string;
  familyKey: BenefitFamilyKey;
  productLineId: string | null;
  status: BenefitServiceStatus;
  sortOrder: number;
  config: BenefitCredentialServiceConfig;
  assignmentStatus: BenefitAssignmentStatus;
  providerKey: CredentialProviderKey;
  assignmentMode: CredentialAssignmentMode;
  credentialReady: boolean;
  credentialSummary: CredentialAssignmentSummaryView | null;
  downloadEnabled: boolean;
  downloadUrl: string | null;
  granted: boolean;
  grantExpiresAt: string | null;
};

export type SanitizedProductLine = {
  id: string;
  name: string;
  displayName: string;
  services: SanitizedBenefitService[];
};

export type SanitizedBenefitFamily = {
  key: BenefitFamilyKey;
  title: string;
  tone: BenefitPanelFamilyView["tone"];
  description: string | null;
  actionableServiceCount: number;
  services: SanitizedBenefitService[];
  productLines: SanitizedProductLine[];
};

export function resolveBenefitServiceSelection<
  T extends { id: string; productLineId?: string | null; config: { apiDeliveryMode: string } },
>(services: T[], targetedServiceId: string | null | undefined) {
  const targetedService = services.find((service) => service.id === targetedServiceId) ?? null;
  const defaultProductLineId = services[0]?.productLineId ?? null;
  const selectedProductLineId = targetedService?.productLineId ?? defaultProductLineId;
  const lineServices = services.filter(
    (service) => (service.productLineId ?? null) === selectedProductLineId,
  );
  const firstRefillService = lineServices.find((service) => service.config.apiDeliveryMode !== "service_proxy") ?? null;
  const firstApiService = lineServices.find((service) => service.config.apiDeliveryMode === "service_proxy") ?? null;

  return {
    targetedService,
    refillService:
      targetedService && targetedService.config.apiDeliveryMode !== "service_proxy"
        ? targetedService
        : firstRefillService,
    apiService:
      targetedService?.config.apiDeliveryMode === "service_proxy"
        ? targetedService
        : firstApiService,
  };
}

export function resolveBenefitFamilySelection<
  T extends { key: string; services: Array<{ id: string }> },
>(
  families: T[],
  currentFamilyKey: string | null | undefined,
  targetedFamilyKey: string | null | undefined,
  targetedServiceId: string | null | undefined,
) {
  return (
    families.find((family) => family.key === targetedFamilyKey)?.key ??
    families.find((family) => family.services.some((service) => service.id === targetedServiceId))?.key ??
    families.find((family) => family.key === currentFamilyKey)?.key ??
    families[0]?.key ??
    null
  );
}

export function resolveBenefitServiceDependency<T>(args: {
  ok: boolean;
  value?: T | null;
  error?: string | null;
  fallbackMessage: string;
}) {
  if (!args.ok || args.value == null) {
    return {
      data: null,
      error: args.error?.trim() || args.fallbackMessage,
    };
  }

  return {
    data: args.value,
    error: null,
  };
}

function mapSanitizedService(service: BenefitPanelFamilyView["services"][number]): SanitizedBenefitService {
  return {
    id: service.id,
    title: service.title,
    familyKey: service.familyKey,
    productLineId: service.productLineId ?? null,
    status: service.status,
    sortOrder: service.sortOrder,
    config: service.config,
    assignmentStatus: service.assignmentStatus,
    providerKey: service.providerKey,
    assignmentMode: service.assignmentMode,
    credentialReady: service.credentialReady,
    credentialSummary: service.credentialSummary,
    downloadEnabled: service.downloadEnabled,
    downloadUrl: service.downloadUrl,
    granted: service.granted ?? false,
    grantExpiresAt: service.grantExpiresAt ?? null,
  };
}

export function sanitizeBenefitPanel(panel: BenefitPanelView): SanitizedBenefitFamily[] {
  return panel.families.map((family) => ({
    key: family.key,
    title: family.title,
    tone: family.tone,
    description: family.description,
    actionableServiceCount: family.actionableServiceCount,
    services: family.services.map(mapSanitizedService),
    productLines: (family.productLines ?? []).map((pl) => ({
      id: pl.id,
      name: pl.name,
      displayName: pl.displayName,
      services: pl.services.map(mapSanitizedService),
    })),
  }));
}

export function maskCredentialValue(value: string | null | undefined, fallback = "等待补位"): string {
  if (!value) {
    return fallback;
  }

  if (value.length <= 8) {
    return "••••••••";
  }

  return `${value.slice(0, 4)}••••••${value.slice(-4)}`;
}
