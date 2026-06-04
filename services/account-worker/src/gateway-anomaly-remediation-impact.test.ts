import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayAnalysisAnomalyIncidentRemediationRunView } from "@neuro/contracts";

import { selectGatewayAnomalyRemediationImpactCandidates } from "./gateway-anomaly-remediation-impact-helpers";

function createRun(
  id: string,
  overrides: Partial<GatewayAnalysisAnomalyIncidentRemediationRunView> = {},
): GatewayAnalysisAnomalyIncidentRemediationRunView {
  return {
    id,
    incidentId: `incident_${id}`,
    policyId: "policy_1",
    routePolicyId: "route_1",
    actionKey: "reduce-provider-concurrency",
    title: "Reduce provider concurrency",
    executionMode: "route_policy_patch",
    status: "applied",
    dryRun: false,
    actorUserId: "ops_1",
    note: null,
    input: null,
    result: null,
    beforeIncident: null,
    afterIncident: null,
    beforeRoutePolicy: null,
    afterRoutePolicy: null,
    errorSummary: null,
    createdAt: "2026-04-06T09:00:00.000Z",
    completedAt: "2026-04-06T09:10:00.000Z",
    ...overrides,
  };
}

describe("gateway anomaly remediation impact capture selection", () => {
  it("selects only matured applied runs without matching impact capture", () => {
    const referenceTime = new Date("2026-04-06T12:30:00.000Z");
    const selected = selectGatewayAnomalyRemediationImpactCandidates({
      runs: [
        createRun("run_old"),
        createRun("run_recent", {
          completedAt: "2026-04-06T11:40:00.000Z",
        }),
        createRun("run_captured", {
          result: {
            impactCapture: {
              windowMinutes: 180,
              impact: { ok: true },
            },
          },
        }),
        createRun("run_failed", {
          status: "failed",
        }),
      ],
      referenceTime,
      windowMinutes: 180,
      limit: 10,
    });

    assert.deepEqual(
      selected.map((item) => item.id),
      ["run_old"],
    );
  });
});
