// Thin facade: AI gateway contracts live in ./ai-gateway/*.
// This file re-exports the original public API unchanged; add new types to the submodules.
export * from "./ai-gateway/shared";
export * from "./ai-gateway/identity";
export * from "./ai-gateway/provider";
export * from "./ai-gateway/routing";
export * from "./ai-gateway/access";
export * from "./ai-gateway/browser";
export * from "./ai-gateway/sessions";
export * from "./ai-gateway/archive";
export * from "./ai-gateway/prompt-cache";
export * from "./ai-gateway/analysis";
export * from "./ai-gateway/anomaly";
export * from "./ai-gateway/operator-catalog";
export * from "./ai-gateway/rate-limit-hotspots";
