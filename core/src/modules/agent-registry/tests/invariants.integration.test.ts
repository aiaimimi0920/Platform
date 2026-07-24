import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() || null;

function isHttpError(error: unknown, statusCode: number, pattern: RegExp) {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode?: unknown }).statusCode === statusCode &&
    "message" in error &&
    pattern.test(String((error as { message?: unknown }).message))
  );
}

if (!databaseUrl) {
  test("agent-registry integration requires DATABASE_URL from the embedded PostgreSQL harness", () => {
    throw new Error("DATABASE_URL is required for agent-registry integration coverage");
  });
} else {
  test("agent registry enforces ownership, callback governance, and capability uniqueness", { timeout: 120_000 }, async () => {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 1,
    });
    pool.on("error", () => undefined);

    let corePool: { end: () => Promise<void> } | null = null;
    let accountPool: { end: () => Promise<void> } | null = null;
    let accountRedis: { disconnect: () => void } | null = null;

    try {
      await pool.query(`
        insert into users (id, username, email, avatar_url, trust_level, created_at, updated_at, last_login_at)
        values
          ('operator-1', 'operator-1', 'operator-1@example.test', null, 4, now(), now(), now()),
          ('owner-b', 'owner-b', 'owner-b@example.test', null, 3, now(), now(), now())
      `);

      const {
        addCapabilityToOwnedAgent,
        createOwnedAgent,
        listOwnedAgentCapabilities,
        rotateOwnedAgentCallbackSecret,
        updateOwnedAgentCallbackProtocolVersion,
      } = await import("../service");
      ({ pgPool: corePool } = await import("../../../db/client"));
      ({ pgPool: accountPool } = await import("../../../../../packages/account-domain/dist/db/client.js"));
      ({ redis: accountRedis } = await import("../../../../../packages/account-domain/dist/db/redis.js"));

      const platformAgent = await createOwnedAgent("operator-1", {
        name: "Platform planner",
        description: "Owned platform execution agent",
        sourceType: "platform",
      });
      assert.equal(platformAgent.sourceType, "platform");
      assert.equal(platformAgent.runtimeEndpoint, null);

      await assert.rejects(
        () =>
          createOwnedAgent("operator-1", {
            name: "Broken external agent",
            description: "Missing callback endpoint",
            sourceType: "external",
          }),
        (error: unknown) => isHttpError(error, 400, /runtimeendpoint/i),
      );

      const externalAgent = await createOwnedAgent("operator-1", {
        name: "External worker",
        description: "External runtime with callback governance",
        sourceType: "external",
        runtimeEndpoint: "https://agent-runtime.example.test/dispatch",
      });
      assert.equal(externalAgent.sourceType, "external");
      assert.equal(externalAgent.externalCallbackProtocolVersion, 1);
      assert.equal(externalAgent.externalCallbackSecretVersion, 1);

      const rotatedSecret = await rotateOwnedAgentCallbackSecret("operator-1", externalAgent.id);
      assert.equal(rotatedSecret.agent.externalCallbackSecretVersion, 2);
      assert.ok(rotatedSecret.callbackSecret.length > 16);
      assert.notEqual(rotatedSecret.agent.externalCallbackSecretPreview, externalAgent.externalCallbackSecretPreview);

      const updatedProtocol = await updateOwnedAgentCallbackProtocolVersion("operator-1", externalAgent.id, {
        protocolVersion: 2,
      });
      assert.equal(updatedProtocol.externalCallbackProtocolVersion, 2);
      assert.equal(updatedProtocol.externalCallbackPreviousProtocolVersion, 1);
      assert.notEqual(updatedProtocol.externalCallbackProtocolGraceUntil, null);

      const capability = await addCapabilityToOwnedAgent("operator-1", platformAgent.id, {
        code: "compose-plan",
        title: "Compose plan",
        description: "Creates a scoped execution plan.",
      });
      assert.equal(capability.code, "compose-plan");

      const listedCapabilities = await listOwnedAgentCapabilities("operator-1", platformAgent.id);
      assert.equal(listedCapabilities.length, 1);
      assert.equal(listedCapabilities[0]?.id, capability.id);

      await assert.rejects(
        () =>
          addCapabilityToOwnedAgent("operator-1", platformAgent.id, {
            code: "compose-plan",
            title: "Duplicate code",
            description: "Should conflict",
          }),
        (error: unknown) => isHttpError(error, 409, /already exists/i),
      );

      await assert.rejects(
        () => listOwnedAgentCapabilities("owner-b", platformAgent.id),
        (error: unknown) => isHttpError(error, 404, /not owned/i),
      );

      await assert.rejects(
        () =>
          addCapabilityToOwnedAgent("owner-b", platformAgent.id, {
            code: "other-owner",
            title: "Should not work",
            description: "Cross-owner write attempt",
          }),
        (error: unknown) => isHttpError(error, 404, /not owned/i),
      );
    } finally {
      accountRedis?.disconnect();
      await corePool?.end().catch(() => undefined);
      await accountPool?.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  });
}
