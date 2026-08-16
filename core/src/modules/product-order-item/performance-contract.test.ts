import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";

const moduleDir = dirname(__filename);

test("product and manual-review performance boundaries stay bounded and deterministic", () => {
  const productCatalog = readFileSync(join(moduleDir, "service", "product-catalog.ts"), "utf8");
  assert.match(productCatalog, /\.limit\(limit \+ 1\)/);
  assert.match(productCatalog, /\.orderBy\(desc\(products\.updatedAt\), desc\(products\.id\)\)/);
  assert.match(productCatalog, /encodeOperatorProductCursor/);

  const manualReview = readFileSync(join(moduleDir, "service", "manual-review.ts"), "utf8");
  assert.match(manualReview, /\.limit\(MANUAL_REVIEW_WORKLOAD_SCAN_LIMIT \+ 1\)/);
  const autoAssignStart = manualReview.indexOf("export async function autoAssignSlaItemManualReviews");
  assert.notEqual(autoAssignStart, -1);
  const autoAssignSource = manualReview.slice(autoAssignStart);
  assert.equal((autoAssignSource.match(/getManualReviewWorkload\(/g) ?? []).length, 2);
  const assignmentLoopStart = autoAssignSource.indexOf("for (const candidate of queue)");
  const refreshedWorkloadStart = autoAssignSource.indexOf("const refreshedWorkload = await getManualReviewWorkload");
  assert.ok(assignmentLoopStart >= 0 && refreshedWorkloadStart > assignmentLoopStart);
  assert.doesNotMatch(autoAssignSource.slice(assignmentLoopStart, refreshedWorkloadStart), /getManualReviewWorkload\(/);
  assert.match(autoAssignSource, /localBuckets\.set\(assigneeUserId, localBucket\)/);
});

test("arbitration claim-next ranks and fences candidates in PostgreSQL", () => {
  const claims = readFileSync(join(moduleDir, "..", "arbitration", "service", "claims.ts"), "utf8");
  assert.match(claims, /for update of ac skip locked/);
  assert.match(claims, /limit 100/);
  assert.match(claims, /isNull\(arbitrationCases\.assignedOperatorUserId\)/);
  assert.match(claims, /make_interval\(hours => \(\$\{staleHoursSql\}\)::int\)/);
  assert.match(claims, /getRoundStaleHoursSql/);
  assert.ok(claims.includes("const match = /^round:(\\d+)$/.exec(key);"));
  assert.doesNotMatch(claims, /interval '1 hour'/);
  assert.doesNotMatch(claims, /listUnassignedActiveArbitrationCaseCandidates/);
});
