import type { GatewayProviderAccountPayload, GatewayRoutePolicyConfig, GatewaySessionBackedProviderRuntime } from "@neuro/contracts";
import { and, asc, eq, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { redis } from "@/db/redis";
import { env } from "@/env";
import { readGatewayObject } from "@/modules/gateway/object-storage";
import { gatewayProviderAccounts } from "@/modules/gateway/schema";
import { ConflictError } from "@neuro/backend-foundation/platform/errors";

import { now, requestGatewayProviderText, truncateErrorSummary } from "./shared";
import type { GatewayProviderAccountRow } from "./shared";
import { isGatewaySearchProviderPayload } from "./provider-identity";
import { normalizeSessionAuthTransport } from "./provider-source-profile";
import { readProviderAccountPayload } from "./views";

export async function reactivateExpiredCoolingProviderAccounts() {
  const timestamp = now();
  const rows = await db
    .select()
    .from(gatewayProviderAccounts)
    .where(
      and(
        eq(gatewayProviderAccounts.status, "cooling"),
        lte(gatewayProviderAccounts.cooldownUntil, timestamp),
      ),
    )
    .orderBy(asc(gatewayProviderAccounts.cooldownUntil))
    .limit(50);

  for (const row of rows) {
    await withProviderProbeLock(row.id, async () => {
      const [fresh] = await db
        .select()
        .from(gatewayProviderAccounts)
        .where(eq(gatewayProviderAccounts.id, row.id))
        .limit(1);
      if (!fresh || fresh.status !== "cooling") {
        return;
      }
      if (fresh.cooldownUntil && fresh.cooldownUntil > now()) {
        return;
      }

      try {
        await probeGatewayProviderAccount(fresh);
        await db
          .update(gatewayProviderAccounts)
          .set({
            status: "active",
            cooldownUntil: null,
            lastError: null,
            lastHealthCheckAt: now(),
            updatedAt: now(),
          })
          .where(eq(gatewayProviderAccounts.id, fresh.id));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db
          .update(gatewayProviderAccounts)
          .set({
            cooldownUntil: new Date(Date.now() + 30_000),
            lastError: truncateErrorSummary(message, 1000),
            lastHealthCheckAt: now(),
            updatedAt: now(),
          })
          .where(eq(gatewayProviderAccounts.id, fresh.id));
      }
    });
  }
}

export async function sweepGatewayCoolingProviders() {
  await reactivateExpiredCoolingProviderAccounts();
}

export function buildGatewayProviderModelsCacheKey(providerAccountId: string) {
  return `ai-gateway:provider:${providerAccountId}:models`;
}

export function buildGatewayProviderProbeLockKey(providerAccountId: string) {
  return `ai-gateway:provider:${providerAccountId}:probe-lock`;
}

export function applySessionBackedHeaders(headers: Headers, payload: GatewaySessionBackedProviderRuntime & { apiKey: string }) {
  const sessionAuth = payload.sessionAuth;
  const transport = normalizeSessionAuthTransport(sessionAuth?.transport);
  if (transport === "cookie") {
    const primary = sessionAuth?.primaryCookieName?.trim() || "sso";
    const secondary = sessionAuth?.secondaryCookieName?.trim() || "sso-rw";
    const cookies = [`${primary}=${payload.apiKey}`];
    if (secondary) {
      cookies.push(`${secondary}=${payload.apiKey}`);
    }
    headers.set("cookie", cookies.join("; "));
    return;
  }

  const headerName =
    sessionAuth?.headerName?.trim() || (transport === "bearer" ? "authorization" : "x-session-token");
  const headerValue = transport === "bearer" ? `Bearer ${payload.apiKey}` : payload.apiKey;
  headers.set(headerName, headerValue);
}

export function buildGatewayProviderHeaders(payload: GatewayProviderAccountPayload) {
  const headers = new Headers();
  if (payload.adapter === "openai_compatible") {
    if (payload.authMode === "x-api-key") {
      headers.set("x-api-key", payload.apiKey);
    } else if (payload.authMode === "api-key") {
      headers.set("api-key", payload.apiKey);
    } else {
      headers.set("authorization", `Bearer ${payload.apiKey}`);
    }
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }
    return headers;
  }
  if (payload.adapter === "anthropic_compatible") {
    headers.set("x-api-key", payload.apiKey);
    headers.set("anthropic-version", payload.anthropicVersion?.trim() || "2023-06-01");
    for (const beta of payload.betaHeaders ?? []) {
      if (typeof beta === "string" && beta.trim()) {
        headers.append("anthropic-beta", beta.trim());
      }
    }
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }
    return headers;
  }
  if (payload.adapter === "grok_compatible") {
    applySessionBackedHeaders(headers, payload);
    headers.set("x-xai-request-id", randomUUID());
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }
    return headers;
  }
  if (isGatewaySearchProviderPayload(payload)) {
    const authHeaderName = payload.authHeaderName?.trim();
    const authToken = payload.authToken?.trim();
    if (authHeaderName && authToken) {
      headers.set(authHeaderName, authToken);
    } else if (authHeaderName) {
      headers.set(authHeaderName, payload.apiKey);
    } else {
      headers.set("authorization", `Bearer ${payload.apiKey}`);
    }
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }
    return headers;
  }
  if (payload.adapter === "producer_compatible") {
    headers.set("authorization", `Bearer ${payload.apiKey}`);
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }
    return headers;
  }
  if (payload.adapter === "udio_compatible") {
    applySessionBackedHeaders(headers, payload);
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }
    return headers;
  }
  return null;
}

export async function readCachedProviderModels(providerAccountId: string) {
  try {
    const raw = await redis.get(buildGatewayProviderModelsCacheKey(providerAccountId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  } catch {
    return null;
  }
}

export async function writeCachedProviderModels(providerAccountId: string, modelIds: string[]) {
  try {
    await redis.set(
      buildGatewayProviderModelsCacheKey(providerAccountId),
      JSON.stringify(modelIds),
      "EX",
      Math.max(10, env.modelsCacheTtlSeconds),
    );
  } catch {
    return;
  }
}

export async function invalidateCachedProviderModels(providerAccountId: string) {
  try {
    await redis.del(buildGatewayProviderModelsCacheKey(providerAccountId));
  } catch {
    return;
  }
}

export function parseGatewayProviderModelsResponse(payload: GatewayProviderAccountPayload, body: Record<string, unknown>) {
  const collected = new Set<string>();
  const records = [
    ...(Array.isArray(body.data) ? body.data : []),
    ...(Array.isArray(body.models) ? body.models : []),
  ];

  for (const item of records) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const id =
      (typeof record.id === "string" && record.id.trim() ? record.id.trim() : null) ??
      (typeof record.name === "string" && record.name.trim() ? record.name.trim() : null) ??
      (typeof record.model === "string" && record.model.trim() ? record.model.trim() : null);
    if (id) {
      collected.add(id);
    }
  }

  if (payload.adapter === "anthropic_compatible" && collected.size === 0) {
    const topLevelId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
    if (topLevelId) {
      collected.add(topLevelId);
    }
  }

  return Array.from(collected.values());
}

export async function discoverProviderModels(row: GatewayProviderAccountRow) {
  const payload = await readProviderAccountPayload(row);
  const cached = await readCachedProviderModels(row.id);
  if (cached && cached.length > 0) {
    return cached;
  }

  if (payload.adapter !== "openai_compatible" && payload.adapter !== "anthropic_compatible") {
    const defaultModel =
      "defaultModel" in payload && typeof payload.defaultModel === "string" ? payload.defaultModel.trim() : "";
    return defaultModel ? [defaultModel] : [];
  }

  const endpointPath =
    payload.adapter === "openai_compatible"
      ? payload.modelsPath?.trim() || "/models"
      : payload.modelsPath?.trim() || "/models";
  const { response, text } = await requestGatewayProviderText(
    `${payload.baseUrl.replace(/\/+$/, "")}${endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`}`,
    {
      method: "GET",
      headers: buildGatewayProviderHeaders(payload) ?? undefined,
    },
    "Provider models discovery",
  );

  if (!response.ok) {
    await invalidateCachedProviderModels(row.id);
    throw new ConflictError(`Provider models discovery failed with status ${response.status}.`);
  }

  const body = JSON.parse(text) as Record<string, unknown>;
  const modelIds = parseGatewayProviderModelsResponse(payload, body);
  if (modelIds.length > 0) {
    await writeCachedProviderModels(row.id, modelIds);
  } else {
    await invalidateCachedProviderModels(row.id);
  }
  await db
    .update(gatewayProviderAccounts)
    .set({
      lastHealthCheckAt: now(),
      updatedAt: now(),
    })
    .where(eq(gatewayProviderAccounts.id, row.id));
  return modelIds;
}

export async function probeGatewayProviderAccount(row: GatewayProviderAccountRow) {
  const payload = await readProviderAccountPayload(row);

  if (payload.adapter === "openai_compatible" || payload.adapter === "anthropic_compatible") {
    await discoverProviderModels(row);
    return;
  }

  if (payload.adapter === "codex_cli") {
    await readGatewayObject(payload.codexHomeBundleObjectKey);
    return;
  }

  if (payload.adapter === "claude_code") {
    await readGatewayObject(payload.claudeHomeBundleObjectKey);
    return;
  }

  if (payload.adapter === "grok_compatible") {
    const { response } = await requestGatewayProviderText(
      payload.baseUrl.replace(/\/+$/, ""),
      {
        method: "GET",
        headers: buildGatewayProviderHeaders(payload) ?? undefined,
      },
      "Provider probe",
    );
    if (response.status >= 500) {
      throw new ConflictError(`Provider probe failed with status ${response.status}.`);
    }
    return;
  }

  if (payload.adapter === "kiro_compatible") {
    return;
  }

  if (isGatewaySearchProviderPayload(payload)) {
    const balancePath =
      "balancePath" in payload && typeof payload.balancePath === "string" && payload.balancePath.trim()
        ? payload.balancePath.trim()
        : "/v1/credits/balance";
    const { response } = await requestGatewayProviderText(
      `${payload.baseUrl.replace(/\/+$/, "")}${balancePath.startsWith("/") ? balancePath : `/${balancePath}`}`,
      {
        method: "GET",
        headers: buildGatewayProviderHeaders(payload) ?? undefined,
      },
      "Provider probe",
    );
    if (!response.ok) {
      throw new ConflictError(`Provider probe failed with status ${response.status}.`);
    }
    return;
  }

  if (payload.adapter === "producer_compatible") {
    const { response } = await requestGatewayProviderText(
      `${payload.baseUrl.replace(/\/+$/, "")}/__api/billing/credits`,
      {
        method: "GET",
        headers: buildGatewayProviderHeaders(payload) ?? undefined,
      },
      "Provider probe",
    );
    if (!response.ok) {
      throw new ConflictError(`Provider probe failed with status ${response.status}.`);
    }
    return;
  }

  if (payload.adapter === "udio_compatible") {
    const { response } = await requestGatewayProviderText(
      `${payload.baseUrl.replace(/\/+$/, "")}/api/users/current`,
      {
        method: "GET",
        headers: buildGatewayProviderHeaders(payload) ?? undefined,
      },
      "Provider probe",
    );
    if (!response.ok) {
      throw new ConflictError(`Provider probe failed with status ${response.status}.`);
    }
    return;
  }

  if (payload.adapter === "custom_http" || payload.adapter === "provider_passthrough") {
    const headers = new Headers();
    if (payload.authHeaderName?.trim() && payload.authToken?.trim()) {
      headers.set(payload.authHeaderName.trim(), payload.authToken.trim());
    }
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }

    const providerUrl = payload.baseUrl.replace(/\/+$/, "");
    const { response } = await requestGatewayProviderText(
      providerUrl,
      {
        method: "HEAD",
        headers,
      },
      "Provider HEAD probe",
    ).catch(() =>
      requestGatewayProviderText(
        providerUrl,
        {
          method: "GET",
          headers,
        },
        "Provider GET probe",
      ),
    );

    if (response.status >= 500) {
      throw new ConflictError(`Provider probe failed with status ${response.status}.`);
    }
  }
}

export async function withProviderProbeLock<T>(providerAccountId: string, callback: () => Promise<T>): Promise<T | null> {
  const lockKey = buildGatewayProviderProbeLockKey(providerAccountId);
  const token = randomUUID();
  const acquired = await redis.set(lockKey, token, "PX", 15_000, "NX");
  if (acquired !== "OK") {
    return null;
  }
  try {
    return await callback();
  } finally {
    const current = await redis.get(lockKey);
    if (current === token) {
      await redis.del(lockKey);
    }
  }
}

export function buildGatewayProviderConcurrencyKey(providerAccountId: string) {
  return `ai-gateway:provider:${providerAccountId}:concurrency`;
}

export function buildGatewayProviderBreakerOpenKey(providerAccountId: string) {
  return `ai-gateway:provider:${providerAccountId}:breaker-open`;
}

export function buildGatewayProjectConcurrencyKey(projectId: string) {
  return `ai-gateway:project:${projectId}:concurrency`;
}

export async function readRedisInt(key: string) {
  try {
    const raw = await redis.get(key);
    return typeof raw === "string" && Number.isFinite(Number(raw)) ? Math.max(0, Math.floor(Number(raw))) : 0;
  } catch {
    return 0;
  }
}

export async function noteProviderAccountFailure(args: {
  providerAccountId: string;
  routePolicy: GatewayRoutePolicyConfig;
  message: string;
}) {
  const counterKey = `ai-gateway:provider:${args.providerAccountId}:failure-count`;
  const openKey = `ai-gateway:provider:${args.providerAccountId}:breaker-open`;
  const failureCount = await redis.incr(counterKey);
  await redis.expire(counterKey, Math.max(30, args.routePolicy.circuitBreakerCooldownSeconds));

  if (failureCount >= args.routePolicy.circuitBreakerThreshold) {
    await invalidateCachedProviderModels(args.providerAccountId);
    await redis.set(openKey, "1", "EX", Math.max(30, args.routePolicy.circuitBreakerCooldownSeconds));
    await db
      .update(gatewayProviderAccounts)
      .set({
        status: "cooling",
        cooldownUntil: new Date(Date.now() + args.routePolicy.circuitBreakerCooldownSeconds * 1000),
        lastError: args.message.slice(0, 1000),
        failureCount,
        updatedAt: now(),
      })
      .where(eq(gatewayProviderAccounts.id, args.providerAccountId));
  } else {
    await db
      .update(gatewayProviderAccounts)
      .set({
        lastError: args.message.slice(0, 1000),
        failureCount,
        updatedAt: now(),
      })
      .where(eq(gatewayProviderAccounts.id, args.providerAccountId));
  }
}

export async function noteProviderAccountSuccess(providerAccountId: string) {
  const counterKey = `ai-gateway:provider:${providerAccountId}:failure-count`;
  const openKey = `ai-gateway:provider:${providerAccountId}:breaker-open`;
  await redis.del(counterKey, openKey);
  await invalidateCachedProviderModels(providerAccountId);
  await db
    .update(gatewayProviderAccounts)
    .set({
      status: "active",
      cooldownUntil: null,
      lastError: null,
      failureCount: 0,
      lastHealthCheckAt: now(),
      updatedAt: now(),
    })
    .where(eq(gatewayProviderAccounts.id, providerAccountId));
}
