import assert from "node:assert/strict";
import { describe, it, beforeEach, mock } from "node:test";

import type {
  GatewayCredentialEntry,
  GatewayCredentialKind,
} from "./credential-cache";

// ---------------------------------------------------------------------------
// In-memory Redis mock
// ---------------------------------------------------------------------------

type PipelineCommand = { cmd: string; args: unknown[] };

function createRedisMock() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const ttls = new Map<string, number>();

  function resolvePipelineCommand(command: PipelineCommand): unknown {
    switch (command.cmd) {
      case "set": {
        const [key, value, flag, ttlValue] = command.args as [string, string, string?, number?];
        store.set(key, value);
        if (flag === "EX" && typeof ttlValue === "number") {
          ttls.set(key, ttlValue);
        }
        return "OK";
      }
      case "del": {
        const [key] = command.args as [string];
        store.delete(key);
        ttls.delete(key);
        return 1;
      }
      case "sadd": {
        const [key, ...members] = command.args as [string, ...string[]];
        if (!sets.has(key)) {
          sets.set(key, new Set());
        }
        for (const m of members) {
          sets.get(key)!.add(m);
        }
        return members.length;
      }
      case "srem": {
        const [key, ...members] = command.args as [string, ...string[]];
        const s = sets.get(key);
        if (!s) return 0;
        let removed = 0;
        for (const m of members) {
          if (s.delete(m)) removed++;
        }
        return removed;
      }
      default:
        return null;
    }
  }

  const redisMock = {
    get: mock.fn(async (key: string) => store.get(key) ?? null),

    mget: mock.fn(async (...keys: string[]) =>
      keys.map((k) => store.get(k) ?? null),
    ),

    smembers: mock.fn(async (key: string) => {
      const s = sets.get(key);
      return s ? Array.from(s) : [];
    }),

    srem: mock.fn(async (key: string, ...members: string[]) => {
      const s = sets.get(key);
      if (!s) return 0;
      let removed = 0;
      for (const m of members) {
        if (s.delete(m)) removed++;
      }
      return removed;
    }),

    pipeline: mock.fn(() => {
      const commands: PipelineCommand[] = [];
      const pipelineProxy = {
        set: (...args: unknown[]) => {
          commands.push({ cmd: "set", args });
          return pipelineProxy;
        },
        del: (...args: unknown[]) => {
          commands.push({ cmd: "del", args });
          return pipelineProxy;
        },
        sadd: (...args: unknown[]) => {
          commands.push({ cmd: "sadd", args });
          return pipelineProxy;
        },
        srem: (...args: unknown[]) => {
          commands.push({ cmd: "srem", args });
          return pipelineProxy;
        },
        exec: async () => {
          return commands.map((c) => [null, resolvePipelineCommand(c)]);
        },
      };
      return pipelineProxy;
    }),

    // Expose internals for test assertions
    _store: store,
    _sets: sets,
    _ttls: ttls,
  };

  return redisMock;
}

// ---------------------------------------------------------------------------
// Module loader with mocked Redis
// ---------------------------------------------------------------------------

let redisMock: ReturnType<typeof createRedisMock>;

let getGatewayCredential: (id: string) => Promise<GatewayCredentialEntry | null>;
let setGatewayCredential: (entry: GatewayCredentialEntry) => Promise<void>;
let deleteGatewayCredential: (id: string) => Promise<void>;
let listGatewayCredentialsByProject: (projectId: string) => Promise<GatewayCredentialEntry[]>;
let listGatewayCredentialsByUser: (userId: string) => Promise<GatewayCredentialEntry[]>;
let resolveGatewayCredentialForRequest: (args: {
  projectId: string;
  userId: string;
  provider?: string;
  preferredCredentialId?: string;
}) => Promise<GatewayCredentialEntry | null>;

// We dynamically import the module after registering the Redis mock.
// node:test's `mock.module` is used for ESM mocking.
beforeEach(async () => {
  redisMock = createRedisMock();

  mock.module("@/db/redis", {
    namedExports: { redis: redisMock },
  });

  const mod = await import("./credential-cache");
  getGatewayCredential = mod.getGatewayCredential;
  setGatewayCredential = mod.setGatewayCredential;
  deleteGatewayCredential = mod.deleteGatewayCredential;
  listGatewayCredentialsByProject = mod.listGatewayCredentialsByProject;
  listGatewayCredentialsByUser = mod.listGatewayCredentialsByUser;
  resolveGatewayCredentialForRequest = mod.resolveGatewayCredentialForRequest;
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeEntry(
  overrides: Partial<GatewayCredentialEntry> & { id: string },
): GatewayCredentialEntry {
  return {
    kind: "user-owned" as GatewayCredentialKind,
    projectId: "proj-1",
    userId: "user-1",
    provider: "openai",
    apiKey: "sk-test-key",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("credential-cache", () => {
  // -- getGatewayCredential -------------------------------------------------

  describe("getGatewayCredential", () => {
    it("returns null for a non-existent credential", async () => {
      const result = await getGatewayCredential("does-not-exist");
      assert.equal(result, null);
    });

    it("returns a credential that was previously stored", async () => {
      const entry = makeEntry({ id: "cred-1" });
      await setGatewayCredential(entry);

      const result = await getGatewayCredential("cred-1");
      assert.deepEqual(result, entry);
    });
  });

  // -- setGatewayCredential -------------------------------------------------

  describe("setGatewayCredential", () => {
    it("stores the credential as a JSON string under the correct key", async () => {
      const entry = makeEntry({ id: "cred-2" });
      await setGatewayCredential(entry);

      const raw = redisMock._store.get("gw:cred:cred-2");
      assert.ok(raw);
      assert.deepEqual(JSON.parse(raw), entry);
    });

    it("adds the credential id to the project index set", async () => {
      const entry = makeEntry({ id: "cred-3", projectId: "proj-A" });
      await setGatewayCredential(entry);

      const projectSet = redisMock._sets.get("gw:cred:proj:proj-A");
      assert.ok(projectSet);
      assert.equal(projectSet.has("cred-3"), true);
    });

    it("adds the credential id to the user index set", async () => {
      const entry = makeEntry({ id: "cred-4", userId: "user-X" });
      await setGatewayCredential(entry);

      const userSet = redisMock._sets.get("gw:cred:user:user-X");
      assert.ok(userSet);
      assert.equal(userSet.has("cred-4"), true);
    });

    it("uses pipeline SET with EX when expiresAt is in the future", async () => {
      const future = new Date(Date.now() + 3600 * 1000).toISOString();
      const entry = makeEntry({ id: "cred-ttl", expiresAt: future });
      await setGatewayCredential(entry);

      // Verify data was stored
      const raw = redisMock._store.get("gw:cred:cred-ttl");
      assert.ok(raw);
    });

    it("stores without TTL when expiresAt is absent", async () => {
      const entry = makeEntry({ id: "cred-no-ttl" });
      await setGatewayCredential(entry);

      const raw = redisMock._store.get("gw:cred:cred-no-ttl");
      assert.ok(raw);
    });
  });

  // -- deleteGatewayCredential ----------------------------------------------

  describe("deleteGatewayCredential", () => {
    it("removes the credential key and index references", async () => {
      const entry = makeEntry({ id: "cred-del", projectId: "proj-D", userId: "user-D" });
      await setGatewayCredential(entry);
      assert.ok(redisMock._store.has("gw:cred:cred-del"));

      await deleteGatewayCredential("cred-del");

      assert.equal(redisMock._store.has("gw:cred:cred-del"), false);
      const projSet = redisMock._sets.get("gw:cred:proj:proj-D");
      assert.equal(projSet?.has("cred-del") ?? false, false);
      const userSet = redisMock._sets.get("gw:cred:user:user-D");
      assert.equal(userSet?.has("cred-del") ?? false, false);
    });

    it("is a no-op when the credential does not exist", async () => {
      // Should not throw
      await deleteGatewayCredential("ghost");
    });
  });

  // -- listGatewayCredentialsByProject --------------------------------------

  describe("listGatewayCredentialsByProject", () => {
    it("returns an empty array when no credentials exist for the project", async () => {
      const result = await listGatewayCredentialsByProject("empty-proj");
      assert.deepEqual(result, []);
    });

    it("returns all credentials for a project", async () => {
      const a = makeEntry({ id: "c-a", projectId: "proj-list" });
      const b = makeEntry({ id: "c-b", projectId: "proj-list", provider: "anthropic" });
      const c = makeEntry({ id: "c-c", projectId: "other-proj" });

      await setGatewayCredential(a);
      await setGatewayCredential(b);
      await setGatewayCredential(c);

      const result = await listGatewayCredentialsByProject("proj-list");
      assert.equal(result.length, 2);
      const ids = result.map((e) => e.id).sort();
      assert.deepEqual(ids, ["c-a", "c-b"]);
    });

    it("cleans up stale index references when credential keys are missing", async () => {
      const entry = makeEntry({ id: "stale-1", projectId: "proj-stale" });
      await setGatewayCredential(entry);

      // Simulate the credential key expiring while the set index remains
      redisMock._store.delete("gw:cred:stale-1");

      const result = await listGatewayCredentialsByProject("proj-stale");
      assert.deepEqual(result, []);

      // The stale ID should have been removed from the set
      const projSet = redisMock._sets.get("gw:cred:proj:proj-stale");
      assert.equal(projSet?.has("stale-1") ?? false, false);
    });
  });

  // -- listGatewayCredentialsByUser -----------------------------------------

  describe("listGatewayCredentialsByUser", () => {
    it("returns an empty array when no credentials exist for the user", async () => {
      const result = await listGatewayCredentialsByUser("nobody");
      assert.deepEqual(result, []);
    });

    it("returns all credentials for a user across projects", async () => {
      const a = makeEntry({ id: "u-a", userId: "user-multi", projectId: "proj-1" });
      const b = makeEntry({ id: "u-b", userId: "user-multi", projectId: "proj-2" });
      const c = makeEntry({ id: "u-c", userId: "other-user" });

      await setGatewayCredential(a);
      await setGatewayCredential(b);
      await setGatewayCredential(c);

      const result = await listGatewayCredentialsByUser("user-multi");
      assert.equal(result.length, 2);
      const ids = result.map((e) => e.id).sort();
      assert.deepEqual(ids, ["u-a", "u-b"]);
    });
  });

  // -- resolveGatewayCredentialForRequest -----------------------------------

  describe("resolveGatewayCredentialForRequest", () => {
    it("returns the preferred credential when it matches project and user", async () => {
      const entry = makeEntry({ id: "pref-1", projectId: "proj-r", userId: "user-r" });
      await setGatewayCredential(entry);

      const result = await resolveGatewayCredentialForRequest({
        projectId: "proj-r",
        userId: "user-r",
        preferredCredentialId: "pref-1",
      });
      assert.deepEqual(result, entry);
    });

    it("returns null when preferred credential belongs to a different project", async () => {
      const entry = makeEntry({ id: "pref-wrong", projectId: "proj-other", userId: "user-r" });
      await setGatewayCredential(entry);

      const result = await resolveGatewayCredentialForRequest({
        projectId: "proj-r",
        userId: "user-r",
        preferredCredentialId: "pref-wrong",
      });
      assert.equal(result, null);
    });

    it("returns null when preferred credential does not match provider filter", async () => {
      const entry = makeEntry({ id: "pref-prov", projectId: "proj-r", userId: "user-r", provider: "anthropic" });
      await setGatewayCredential(entry);

      const result = await resolveGatewayCredentialForRequest({
        projectId: "proj-r",
        userId: "user-r",
        provider: "openai",
        preferredCredentialId: "pref-prov",
      });
      assert.equal(result, null);
    });

    it("falls through to project listing when preferred credential is missing", async () => {
      const entry = makeEntry({ id: "fallback-1", projectId: "proj-fb", userId: "user-fb" });
      await setGatewayCredential(entry);

      const result = await resolveGatewayCredentialForRequest({
        projectId: "proj-fb",
        userId: "user-fb",
        preferredCredentialId: "does-not-exist",
      });
      assert.deepEqual(result, entry);
    });

    it("returns null when no credentials match the user", async () => {
      const entry = makeEntry({ id: "no-match", projectId: "proj-nm", userId: "someone-else" });
      await setGatewayCredential(entry);

      const result = await resolveGatewayCredentialForRequest({
        projectId: "proj-nm",
        userId: "user-nm",
      });
      assert.equal(result, null);
    });

    it("filters by provider when specified", async () => {
      const openai = makeEntry({ id: "prov-oai", projectId: "proj-pf", userId: "user-pf", provider: "openai" });
      const anthropic = makeEntry({ id: "prov-anth", projectId: "proj-pf", userId: "user-pf", provider: "anthropic" });

      await setGatewayCredential(openai);
      await setGatewayCredential(anthropic);

      const result = await resolveGatewayCredentialForRequest({
        projectId: "proj-pf",
        userId: "user-pf",
        provider: "anthropic",
      });
      assert.equal(result?.id, "prov-anth");
    });

    it("prefers user-owned over platform credentials", async () => {
      const platformUnlimited = makeEntry({
        id: "plat-u",
        projectId: "proj-pri",
        userId: "user-pri",
        kind: "platform-unlimited",
      });
      const userOwned = makeEntry({
        id: "user-o",
        projectId: "proj-pri",
        userId: "user-pri",
        kind: "user-owned",
      });

      await setGatewayCredential(platformUnlimited);
      await setGatewayCredential(userOwned);

      const result = await resolveGatewayCredentialForRequest({
        projectId: "proj-pri",
        userId: "user-pri",
      });
      assert.equal(result?.id, "user-o");
    });

    it("prefers account-credential over platform credentials", async () => {
      const platformUnlimited = makeEntry({
        id: "plat-unl",
        projectId: "proj-ac",
        userId: "user-ac",
        kind: "platform-unlimited",
      });
      const accountCred = makeEntry({
        id: "acct-c",
        projectId: "proj-ac",
        userId: "user-ac",
        kind: "account-credential",
        accountPayload: { accountId: "acc-123" },
      });

      await setGatewayCredential(platformUnlimited);
      await setGatewayCredential(accountCred);

      const result = await resolveGatewayCredentialForRequest({
        projectId: "proj-ac",
        userId: "user-ac",
      });
      assert.equal(result?.id, "acct-c");
    });

    it("prefers platform-unlimited over platform-limited", async () => {
      const limited = makeEntry({
        id: "plat-lim",
        projectId: "proj-pu",
        userId: "user-pu",
        kind: "platform-limited",
        quotaTotalTokens: 100000,
        quotaRemainingTokens: 50000,
      });
      const unlimited = makeEntry({
        id: "plat-unl",
        projectId: "proj-pu",
        userId: "user-pu",
        kind: "platform-unlimited",
      });

      await setGatewayCredential(limited);
      await setGatewayCredential(unlimited);

      const result = await resolveGatewayCredentialForRequest({
        projectId: "proj-pu",
        userId: "user-pu",
      });
      assert.equal(result?.id, "plat-unl");
    });

    it("prefers platform-limited credentials with more remaining quota", async () => {
      const low = makeEntry({
        id: "lim-low",
        projectId: "proj-q",
        userId: "user-q",
        kind: "platform-limited",
        quotaTotalTokens: 100000,
        quotaRemainingTokens: 1000,
      });
      const high = makeEntry({
        id: "lim-high",
        projectId: "proj-q",
        userId: "user-q",
        kind: "platform-limited",
        quotaTotalTokens: 100000,
        quotaRemainingTokens: 90000,
      });

      await setGatewayCredential(low);
      await setGatewayCredential(high);

      const result = await resolveGatewayCredentialForRequest({
        projectId: "proj-q",
        userId: "user-q",
      });
      assert.equal(result?.id, "lim-high");
    });

    it("returns null when the project has no credentials at all", async () => {
      const result = await resolveGatewayCredentialForRequest({
        projectId: "empty-proj",
        userId: "user-empty",
      });
      assert.equal(result, null);
    });
  });
});
