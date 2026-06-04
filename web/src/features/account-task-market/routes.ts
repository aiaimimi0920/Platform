import { TASK_MARKET_ROUTE } from "./constants";

type TaskMarketHrefOptions = {
  status?: "success" | "error" | null;
  message?: string | null;
  panel?: "publish" | "capability" | "market" | null;
  tab?: "request" | "buy" | "sell" | "take" | null;
  mode?: "tasks" | "buy" | "sell" | null;
  marketCurrency?: "obsidian" | "mira" | null;
  priceTab?: "flat" | "metered" | null;
  query?: string | null;
  composer?: "request" | "sell" | null;
  taskId?: string | null;
  executionId?: string | null;
  listingId?: string | null;
  capabilityId?: string | null;
  capabilityCode?: string | null;
  preferredCapabilityCodes?: string | null;
  title?: string | null;
  description?: string | null;
  pricingMode?: "flat_task" | "token_metered" | "property_metered" | null;
  operationMode?: "manual" | "automatic" | null;
  billingUnit?: string | null;
  meterKey?: string | null;
  meterQuantity?: number | null;
  rewardCurrency?: "obsidian" | "mira" | null;
  rewardAmount?: number | null;
  filterPricingMode?: "flat_task" | "token_metered" | "property_metered" | "all" | null;
  filterOperationMode?: "manual" | "automatic" | "all" | null;
  minimumReward?: number | null;
};

export function buildTaskMarketHref(options: TaskMarketHrefOptions = {}) {
  const params = new URLSearchParams();

  if (options.status) {
    params.set("status", options.status);
  }
  if (options.message) {
    params.set("message", options.message);
  }
  if (options.panel) {
    params.set("panel", options.panel);
  }
  if (options.tab) {
    params.set("tab", options.tab);
  }
  if (options.mode) {
    params.set("mode", options.mode);
  }
  if (options.marketCurrency) {
    params.set("marketCurrency", options.marketCurrency);
  }
  if (options.priceTab) {
    params.set("priceTab", options.priceTab);
  }
  if (options.query) {
    params.set("query", options.query);
  }
  if (options.composer) {
    params.set("composer", options.composer);
  }
  if (options.taskId) {
    params.set("taskId", options.taskId);
  }
  if (options.executionId) {
    params.set("executionId", options.executionId);
  }
  if (options.listingId) {
    params.set("listingId", options.listingId);
  }
  if (options.capabilityId) {
    params.set("capabilityId", options.capabilityId);
  }
  if (options.capabilityCode) {
    params.set("capabilityCode", options.capabilityCode);
  }
  if (options.preferredCapabilityCodes) {
    params.set("preferredCapabilityCodes", options.preferredCapabilityCodes);
  }
  if (options.title) {
    params.set("title", options.title);
  }
  if (options.description) {
    params.set("description", options.description);
  }
  if (options.pricingMode) {
    params.set("pricingMode", options.pricingMode);
  }
  if (options.operationMode) {
    params.set("operationMode", options.operationMode);
  }
  if (options.billingUnit) {
    params.set("billingUnit", options.billingUnit);
  }
  if (options.meterKey) {
    params.set("meterKey", options.meterKey);
  }
  if (typeof options.meterQuantity === "number") {
    params.set("meterQuantity", String(options.meterQuantity));
  }
  if (options.rewardCurrency) {
    params.set("rewardCurrency", options.rewardCurrency);
  }
  if (typeof options.rewardAmount === "number") {
    params.set("rewardAmount", String(options.rewardAmount));
  }
  if (options.filterPricingMode) {
    params.set("pricingModeFilter", options.filterPricingMode);
  }
  if (options.filterOperationMode) {
    params.set("operationModeFilter", options.filterOperationMode);
  }
  if (typeof options.minimumReward === "number") {
    params.set("minimumReward", String(options.minimumReward));
  }

  const query = params.toString();
  return query ? `${TASK_MARKET_ROUTE}?${query}` : TASK_MARKET_ROUTE;
}
