import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import test from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8");
const workflowNames = readdirSync(resolve(root, ".github/workflows"));

test("security workflows keep least privilege and untrusted PR boundaries", () => {
  for (const name of ["repository-quality.yml", "codeql.yml"]) {
    const workflow = read(`.github/workflows/${name}`);
    assert.match(workflow, /contents: read/);
    assert.match(workflow, /persist-credentials: false/);
    assert.match(workflow, /timeout-minutes:/);
    assert.doesNotMatch(workflow, /pull_request_target|secrets\.|contents: write|packages: write|id-token:/);
    for (const [, ref] of workflow.matchAll(/uses:\s+([^\s]+) /g)) {
      assert.match(ref, /@[a-f0-9]{40}$/);
    }
  }
});

test("secret and workflow scanners have exact verified releases and fail closed", () => {
  const install = read("scripts/ci/install-tool.sh");
  assert.match(install, /set -euo pipefail/);
  assert.match(install, /sha256sum --check --status/);
  assert.match(install, /v1\.7\.12\//);
  assert.match(install, /v8\.30\.1\//);
  assert.equal([...install.matchAll(/sha256=[a-f0-9]{64}/g)].length, 2);
  const quality = read(".github/workflows/repository-quality.yml");
  assert.match(quality, /fetch-depth: 0/);
  assert.match(quality, /gitleaks" git --redact=100 --no-banner --exit-code=1/);
  assert.doesNotMatch(quality, /continue-on-error|\|\| true/);
});

test("Dependabot tracks Actions with bounded pull requests", () => {
  const config = read(".github/dependabot.yml");
  assert.match(config, /package-ecosystem: github-actions/);
  assert.match(config, /interval: weekly/);
  assert.match(config, /open-pull-requests-limit: [1-5]/);
});

test("OSV scans the real workspace lock without suppressing vulnerabilities", () => {
  const workflow = read(".github/workflows/dependency-security.yml");
  assert.match(workflow, /--lockfile=\.\/package-lock\.json/);
  assert.match(workflow, /fail-on-vuln: true/);
  assert.match(workflow, /upload-sarif: true/);
  assert.match(workflow, /ref: \$\{\{ github\.ref \}\}/);
  assert.doesNotMatch(workflow, /--config=|continue-on-error/);
  assert.ok(existsSync(resolve(root, "package-lock.json")));
});


test("secret exclusions are exact independently reviewable historical fingerprints", () => {
  const reviewed = JSON.parse(read("scripts/ci/gitleaks-reviewed-findings.json"));
  const ignored = read(".gitleaksignore").split(/\r?\n/).filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(ignored, reviewed.map((item) => item.fingerprint));
  assert.equal(new Set(ignored).size, ignored.length);
  for (const item of reviewed) {
    assert.match(item.fingerprint, /^[a-f0-9]{40}:[^*]+:[a-z0-9-]+:\d+$/);
    assert.ok(item.reason.length > 30);
  }
});


test("Dependabot only configures supported updaters for the pinned toolchains", () => {
  const ecosystems = [...read(".github/dependabot.yml").matchAll(/package-ecosystem: ([a-z-]+)/g)].map((match) => match[1]);
  assert.deepEqual(ecosystems.sort(), ["docker", "github-actions", "npm"]);
  assert.match(read("package.json"), /npm run infra:tofu:validate/);
  assert.match(read("scripts/validate-tofu.mjs"), /-backend=false/);
  assert.match(read("scripts/validate-tofu.mjs"), /-lockfile=readonly/);
});
