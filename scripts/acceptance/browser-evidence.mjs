import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_BROWSER_PROJECTS = Object.freeze([
  "desktop-chromium",
  "mobile-chromium",
]);

export const BROWSER_JOURNEY_REQUIREMENTS = Object.freeze({
  owner: Object.freeze([
    "O-AUTH",
    "O-COMMERCE",
    "O-TASK",
    "O-AGENT-CHAT",
    "O-PROJECT-GOV",
  ]),
  visitor: Object.freeze(["V-PUBLIC"]),
  operator: Object.freeze(["OP-CONTROL"]),
  errors: Object.freeze(["ERR-DEPENDENCY"]),
});

function collectSpecs(suites, inheritedFile = null, output = []) {
  for (const suite of Array.isArray(suites) ? suites : []) {
    const file = typeof suite?.file === "string" ? suite.file : inheritedFile;
    for (const spec of Array.isArray(suite?.specs) ? suite.specs : []) {
      output.push({ ...spec, file: typeof spec?.file === "string" ? spec.file : file });
    }
    collectSpecs(suite?.suites, file, output);
  }
  return output;
}

function normalizeFile(value) {
  return typeof value === "string" ? value.replaceAll("\\", "/").toLowerCase() : "";
}

function belongsToJourney(spec, journey) {
  const file = normalizeFile(spec.file);
  return file.endsWith(`/${journey}.spec.ts`) || file.includes(`/e2e/${journey}/`);
}

function lastResult(test) {
  const results = Array.isArray(test?.results) ? test.results : [];
  return results.length > 0 ? results[results.length - 1] : null;
}

function assertPassingTest(specs, journeyId, projectName) {
  const tests = specs.flatMap((spec) =>
    (Array.isArray(spec?.tests) ? spec.tests : []).filter(
      (candidate) => candidate?.projectName === projectName,
    ));
  if (tests.length === 0) {
    throw new Error(`Browser journey ${journeyId} is missing project ${projectName}`);
  }
  for (const test of tests) {
    const result = lastResult(test);
    if (test.status !== "expected" || result?.status !== "passed") {
      throw new Error(
        `Browser journey ${journeyId} project ${projectName} is not passed ` +
        `(test=${test.status ?? "unknown"}, result=${result?.status ?? "missing"})`,
      );
    }
  }
}

export async function verifyBrowserEvidence({ journey, reportPath } = {}) {
  if (!Object.hasOwn(BROWSER_JOURNEY_REQUIREMENTS, journey)) {
    throw new TypeError(`Unknown browser journey group: ${journey}`);
  }
  if (typeof reportPath !== "string" || !reportPath.trim()) {
    throw new TypeError("Browser evidence reportPath is required");
  }

  const resolvedReportPath = path.resolve(reportPath);
  let report;
  try {
    report = JSON.parse(await readFile(resolvedReportPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read Playwright JSON report: ${resolvedReportPath}`, { cause: error });
  }
  if (!report || typeof report !== "object" || !Array.isArray(report.suites)) {
    throw new Error("Playwright JSON report is malformed");
  }
  if (Array.isArray(report.errors) && report.errors.length > 0) {
    throw new Error(`Playwright report contains ${report.errors.length} global error(s)`);
  }

  const journeySpecs = collectSpecs(report.suites).filter((spec) => belongsToJourney(spec, journey));
  if (journeySpecs.length === 0) {
    throw new Error(`Playwright report contains no specs for browser journey group ${journey}`);
  }

  const journeyIds = BROWSER_JOURNEY_REQUIREMENTS[journey];
  for (const journeyId of journeyIds) {
    const specs = journeySpecs.filter(
      (candidate) => typeof candidate?.title === "string" && candidate.title.startsWith(journeyId),
    );
    if (specs.length === 0) {
      throw new Error(`Playwright report is missing canonical browser journey ${journeyId}`);
    }
    for (const projectName of REQUIRED_BROWSER_PROJECTS) {
      assertPassingTest(specs, journeyId, projectName);
    }
  }

  return {
    schemaVersion: 1,
    status: "passed",
    journey,
    journeyIds: [...journeyIds],
    projects: [...REQUIRED_BROWSER_PROJECTS],
    verifiedTestRuns: journeyIds.length * REQUIRED_BROWSER_PROJECTS.length,
    reportPath: resolvedReportPath,
  };
}

function parseArgs(argv) {
  const options = { journey: null, reportPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--journey") options.journey = argv[++index];
    else if (argument === "--report") options.reportPath = argv[++index];
    else throw new Error(`Unknown browser evidence argument: ${argument}`);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await verifyBrowserEvidence(parseArgs(process.argv.slice(2)))));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
