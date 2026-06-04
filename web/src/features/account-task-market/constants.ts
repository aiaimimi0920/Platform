export const TASK_MARKET_ROUTE = "/tasks";
export const TASK_MARKET_PANEL_LABEL = "集市";
export const TASK_MARKET_FEATURE_KEY = "account-task-market";

export const TASK_MARKET_PRICING_MODES = [
  "flat_task",
  "token_metered",
  "property_metered",
] as const;

export const TASK_MARKET_OPERATION_MODES = [
  "manual",
  "automatic",
] as const;

export const TASK_MARKET_PANELS = ["publish", "market"] as const;
