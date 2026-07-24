import assert from "node:assert/strict";
import test from "node:test";

test("P3-03: serviceId selects the targeted service within its dual-service row", async () => {
  const utils = await import("./utils");
  const resolveSelection = (utils as unknown as {
    resolveBenefitServiceSelection?: <T extends { id: string; productLineId?: string | null; config: { apiDeliveryMode: string } }>(
      services: T[],
      targetedServiceId: string | null,
    ) => { targetedService: T | null; refillService: T | null; apiService: T | null };
  }).resolveBenefitServiceSelection;

  assert.equal(typeof resolveSelection, "function");
  if (!resolveSelection) return;

  const services = [
    { id: "refill-a", productLineId: "line-a", config: { apiDeliveryMode: "direct_credential" } },
    { id: "api-a", productLineId: "line-a", config: { apiDeliveryMode: "service_proxy" } },
    { id: "refill-b", productLineId: "line-b", config: { apiDeliveryMode: "direct_credential" } },
    { id: "api-b", productLineId: "line-b", config: { apiDeliveryMode: "service_proxy" } },
  ];

  const refillTarget = resolveSelection(services, "refill-b");
  assert.equal(refillTarget.targetedService?.id, "refill-b");
  assert.equal(refillTarget.refillService?.id, "refill-b");
  assert.equal(refillTarget.apiService?.id, "api-b");

  const apiTarget = resolveSelection(services, "api-b");
  assert.equal(apiTarget.targetedService?.id, "api-b");
  assert.equal(apiTarget.refillService?.id, "refill-b");
  assert.equal(apiTarget.apiService?.id, "api-b");

  const missingPair = resolveSelection(
    [{ id: "refill-only-b", productLineId: "line-b", config: { apiDeliveryMode: "direct_credential" } }],
    "refill-only-b",
  );
  assert.equal(missingPair.apiService, null);
});

test("P3-03: missing and non-2xx service detail payloads remain explicit failures", async () => {
  const utils = await import("./utils");
  const resolveDependency = (utils as unknown as {
    resolveBenefitServiceDependency?: <T>(args: {
      ok: boolean;
      value?: T | null;
      error?: string | null;
      fallbackMessage: string;
    }) => { data: T | null; error: string | null };
  }).resolveBenefitServiceDependency;

  assert.equal(typeof resolveDependency, "function");
  if (!resolveDependency) return;

  assert.deepEqual(
    resolveDependency({ ok: false, value: null, error: "上游不可用", fallbackMessage: "凭证不可用" }),
    { data: null, error: "上游不可用" },
  );
  assert.deepEqual(
    resolveDependency({ ok: true, value: null, fallbackMessage: "Prompt Cache 摘要不可用" }),
    { data: null, error: "Prompt Cache 摘要不可用" },
  );
  assert.deepEqual(
    resolveDependency({ ok: true, value: { serviceId: "svc-1" }, fallbackMessage: "不可用" }),
    { data: { serviceId: "svc-1" }, error: null },
  );
});

test("P3-03: polling resolves the selected benefit family from the latest query", async () => {
  const utils = await import("./utils");
  const resolveFamily = (utils as unknown as {
    resolveBenefitFamilySelection?: <T extends { key: string; services: Array<{ id: string }> }>(
      families: T[],
      currentFamilyKey: string | null,
      targetedFamilyKey: string | null,
      targetedServiceId: string | null,
    ) => string | null;
  }).resolveBenefitFamilySelection;

  assert.equal(typeof resolveFamily, "function");
  if (!resolveFamily) return;

  const families = [
    { key: "family-a", services: [{ id: "service-a" }] },
    { key: "family-b", services: [{ id: "service-b" }] },
  ];
  const first = resolveFamily(families, null, "family-a", null);
  assert.equal(first, "family-a");
  assert.equal(resolveFamily(families, first, null, "service-b"), "family-b");
});
