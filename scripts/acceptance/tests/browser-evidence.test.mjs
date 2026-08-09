import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  BROWSER_JOURNEY_REQUIREMENTS,
  REQUIRED_BROWSER_PROJECTS,
  verifyBrowserEvidence,
} from "../browser-evidence.mjs";

function passingReport(journey) {
  return {
    config: {},
    errors: [],
    suites: [
      {
        title: `${journey}.spec.ts`,
        file: `web/e2e/${journey}/${journey}.spec.ts`,
        specs: BROWSER_JOURNEY_REQUIREMENTS[journey].map((journeyId) => ({
          title: `${journeyId} acceptance contract`,
          ok: true,
          tests: REQUIRED_BROWSER_PROJECTS.map((projectName) => ({
            projectName,
            status: "expected",
            results: [{ status: "passed", duration: 10 }],
          })),
        })),
        suites: [],
      },
    ],
    stats: { expected: 1, unexpected: 0, skipped: 0 },
  };
}

async function writeReport(report) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "platform-browser-evidence-"));
  const reportPath = path.join(directory, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report)}\n`, "utf8");
  return reportPath;
}

test("browser evidence requires every canonical journey id in desktop and mobile projects", async () => {
  for (const journey of Object.keys(BROWSER_JOURNEY_REQUIREMENTS)) {
    const result = await verifyBrowserEvidence({
      journey,
      reportPath: await writeReport(passingReport(journey)),
    });
    assert.equal(result.status, "passed");
    assert.deepEqual(result.projects, REQUIRED_BROWSER_PROJECTS);
    assert.deepEqual(result.journeyIds, BROWSER_JOURNEY_REQUIREMENTS[journey]);
  }
});

test("browser evidence rejects a missing mobile project, a skipped test, or an unexpected run", async () => {
  const missingMobile = passingReport("visitor");
  missingMobile.suites[0].specs[0].tests.pop();
  await assert.rejects(
    verifyBrowserEvidence({ journey: "visitor", reportPath: await writeReport(missingMobile) }),
    /mobile-chromium/i,
  );

  const skipped = passingReport("operator");
  skipped.suites[0].specs[0].tests[0].status = "skipped";
  skipped.suites[0].specs[0].tests[0].results[0].status = "skipped";
  await assert.rejects(
    verifyBrowserEvidence({ journey: "operator", reportPath: await writeReport(skipped) }),
    /not passed|skipped/i,
  );

  const unexpected = passingReport("errors");
  unexpected.errors.push({ message: "global fixture failed" });
  await assert.rejects(
    verifyBrowserEvidence({ journey: "errors", reportPath: await writeReport(unexpected) }),
    /report contains.*error/i,
  );
});
