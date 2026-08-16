import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { buildGatewayProjectApiKey, verifyGatewayProjectApiKey } from "@/modules/gateway/api-key";
import { gatewayApiKeys, gatewayProjects, gatewayRoutePolicies, gatewayTenants } from "@/modules/gateway/schema";
import { NotFoundError } from "@neuro/backend-foundation/platform/errors";

import { now, slugify } from "./shared";
import type { GatewayApiKeyRow, GatewayProjectRow, GatewayTenantRow } from "./shared";
import { defaultRoutePolicyConfig, toGatewayApiKeyView, toGatewayProjectView, toGatewayRoutePolicyView, toGatewayTenantView } from "./views";
import { getGatewayProjectById } from "./routing";

export type AuthenticatedGatewayAccess = {
  apiKey: GatewayApiKeyRow;
  project: GatewayProjectRow;
  tenant: GatewayTenantRow;
};

export function buildBenefitTenantSourceKey(userId: string) {
  return `benefit_user:${userId}`;
}

export function buildBenefitProjectSourceKey(serviceId: string, userId: string) {
  return `benefit_service_user:${serviceId}:${userId}`;
}

export async function getOrCreateDefaultRoutePolicyInTx(tx: any, projectId: string, timestamp: Date) {
  const [existing] = await tx
    .select()
    .from(gatewayRoutePolicies)
    .where(and(eq(gatewayRoutePolicies.projectId, projectId), eq(gatewayRoutePolicies.isDefault, true)))
    .limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await tx
    .insert(gatewayRoutePolicies)
    .values({
      id: randomUUID(),
      projectId,
      name: "default",
      isDefault: true,
      enabled: true,
      config: defaultRoutePolicyConfig(),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  await tx
    .update(gatewayProjects)
    .set({
      defaultRoutePolicyId: created.id,
      updatedAt: timestamp,
    })
    .where(eq(gatewayProjects.id, projectId));

  return created;
}

export async function getActiveGatewayApiKeyInTx(tx: any, projectId: string) {
  const [row] = await tx
    .select()
    .from(gatewayApiKeys)
    .where(and(eq(gatewayApiKeys.projectId, projectId), eq(gatewayApiKeys.status, "active")))
    .orderBy(desc(gatewayApiKeys.createdAt), desc(gatewayApiKeys.id))
    .limit(1);
  return row ?? null;
}

export async function createGatewayApiKeyInTx(
  tx: any,
  args: {
    projectId: string;
    name: string;
    rotatedFromApiKeyId?: string | null;
    timestamp: Date;
  },
) {
  const [created] = await tx
    .insert(gatewayApiKeys)
    .values({
      id: randomUUID(),
      projectId: args.projectId,
      name: args.name,
      status: "active",
      rotatedFromApiKeyId: args.rotatedFromApiKeyId ?? null,
      revokedAt: null,
      revokedByUserId: null,
      revokeReason: null,
      createdAt: args.timestamp,
      updatedAt: args.timestamp,
    })
    .returning();
  return created;
}

export async function revokeGatewayApiKeyInTx(
  tx: any,
  row: GatewayApiKeyRow,
  actorUserId: string | null,
  reason: string,
  timestamp: Date,
) {
  const [updated] = await tx
    .update(gatewayApiKeys)
    .set({
      status: "revoked",
      revokedAt: timestamp,
      revokedByUserId: actorUserId,
      revokeReason: reason,
      updatedAt: timestamp,
    })
    .where(eq(gatewayApiKeys.id, row.id))
    .returning();
  return updated ?? row;
}

export async function ensureGatewayBenefitProject(args: {
  serviceId: string;
  userId: string;
  serviceTitle?: string | null;
}) {
  return db.transaction(async (tx) => {
    const timestamp = now();
    const tenantSourceKey = buildBenefitTenantSourceKey(args.userId);
    const [existingTenant] = await tx
      .select()
      .from(gatewayTenants)
      .where(and(eq(gatewayTenants.sourceKind, "benefit_user"), eq(gatewayTenants.sourceKey, tenantSourceKey)))
      .limit(1);

    const tenant =
      existingTenant ??
      (
        await tx
          .insert(gatewayTenants)
          .values({
            id: randomUUID(),
            slug: slugify(`benefit-${args.userId}`),
            displayName: `Benefit ${args.userId}`,
            status: "active",
            ownerUserId: args.userId,
            sourceKind: "benefit_user",
            sourceKey: tenantSourceKey,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .returning()
      )[0];

    const projectSourceKey = buildBenefitProjectSourceKey(args.serviceId, args.userId);
    const [existingProject] = await tx
      .select()
      .from(gatewayProjects)
      .where(and(eq(gatewayProjects.sourceKind, "benefit_service_user"), eq(gatewayProjects.sourceKey, projectSourceKey)))
      .limit(1);

    const project =
      existingProject ??
      (
        await tx
          .insert(gatewayProjects)
          .values({
            id: randomUUID(),
            tenantId: tenant.id,
            slug: slugify(`${args.serviceTitle || args.serviceId}-${args.userId}`),
            displayName: args.serviceTitle?.trim() || `Benefit Service ${args.serviceId}`,
            status: "active",
            sourceKind: "benefit_service_user",
            sourceKey: projectSourceKey,
            defaultRoutePolicyId: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .returning()
      )[0];

    const routePolicy = await getOrCreateDefaultRoutePolicyInTx(tx, project.id, timestamp);

    return {
      tenant: toGatewayTenantView(tenant),
      project: toGatewayProjectView({
        ...project,
        defaultRoutePolicyId: project.defaultRoutePolicyId ?? routePolicy.id,
      }),
      routePolicy: toGatewayRoutePolicyView(routePolicy),
    };
  });
}

export async function resolveGatewayApiAccessForProject(projectId: string, name = "benefit-project-key") {
  const project = await getGatewayProjectById(projectId);
  if (!project || project.status !== "active") {
    throw new NotFoundError("AI gateway project 不存在。");
  }
  const [tenant] = await db.select().from(gatewayTenants).where(eq(gatewayTenants.id, project.tenantId)).limit(1);
  if (!tenant || tenant.status !== "active") {
    throw new NotFoundError("AI gateway tenant 不存在。");
  }

  return db.transaction(async (tx) => {
    let apiKey = await getActiveGatewayApiKeyInTx(tx, projectId);
    if (!apiKey) {
      apiKey = await createGatewayApiKeyInTx(tx, {
        projectId,
        name,
        timestamp: now(),
      });
    }

    return {
      project: toGatewayProjectView(project),
      tenant: toGatewayTenantView(tenant),
      apiKey: toGatewayApiKeyView(apiKey),
      token: buildGatewayProjectApiKey({
        apiKeyId: apiKey.id,
        projectId: project.id,
        tenantId: tenant.id,
      }),
    };
  });
}

export async function rotateGatewayApiAccessForProject(
  projectId: string,
  actorUserId: string | null,
  name = "benefit-project-key",
) {
  const project = await getGatewayProjectById(projectId);
  if (!project || project.status !== "active") {
    throw new NotFoundError("AI gateway project 不存在。");
  }
  const [tenant] = await db.select().from(gatewayTenants).where(eq(gatewayTenants.id, project.tenantId)).limit(1);
  if (!tenant || tenant.status !== "active") {
    throw new NotFoundError("AI gateway tenant 不存在。");
  }

  return db.transaction(async (tx) => {
    const timestamp = now();
    const current = await getActiveGatewayApiKeyInTx(tx, projectId);
    if (current) {
      await revokeGatewayApiKeyInTx(tx, current, actorUserId, "rotated", timestamp);
    }
    const next = await createGatewayApiKeyInTx(tx, {
      projectId,
      name,
      rotatedFromApiKeyId: current?.id ?? null,
      timestamp,
    });
    return {
      project: toGatewayProjectView(project),
      tenant: toGatewayTenantView(tenant),
      apiKey: toGatewayApiKeyView(next),
      token: buildGatewayProjectApiKey({
        apiKeyId: next.id,
        projectId: project.id,
        tenantId: tenant.id,
      }),
    };
  });
}

export async function authenticateGatewayAccessToken(rawToken: string): Promise<AuthenticatedGatewayAccess | null> {
  const token = rawToken?.trim();
  if (!token?.startsWith("new_api_")) {
    return null;
  }

  const encodedPart = token.slice("new_api_".length).split(".")[0];
  let apiKeyId: string | null = null;
  try {
    apiKeyId = encodedPart ? Buffer.from(encodedPart, "base64url").toString("utf8").trim() : null;
  } catch {
    apiKeyId = null;
  }

  if (!apiKeyId) {
    return null;
  }

  const [apiKey] = await db.select().from(gatewayApiKeys).where(eq(gatewayApiKeys.id, apiKeyId)).limit(1);
  if (!apiKey || apiKey.status !== "active") {
    return null;
  }

  const [project] = await db.select().from(gatewayProjects).where(eq(gatewayProjects.id, apiKey.projectId)).limit(1);
  if (!project || project.status !== "active") {
    return null;
  }

  const [tenant] = await db.select().from(gatewayTenants).where(eq(gatewayTenants.id, project.tenantId)).limit(1);
  if (!tenant || tenant.status !== "active") {
    return null;
  }

  if (
    !verifyGatewayProjectApiKey(token, {
      apiKeyId: apiKey.id,
      projectId: project.id,
      tenantId: tenant.id,
    })
  ) {
    return null;
  }

  return {
    apiKey,
    project,
    tenant,
  };
}
