import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PLATFORM_CONTAINER_IMAGES } from "../../container-image-lock.mjs";

const testFilePath = fileURLToPath(import.meta.url);
const platformRoot = path.resolve(path.dirname(testFilePath), "../../..");
const overlays = [
  {
    name: "staging",
    namespace: "neuroloom-staging",
    prefix: "staging-",
    hosts: ["app.staging.neuroloom.internal", "api.staging.neuroloom.internal", "account.staging.neuroloom.internal"],
  },
  {
    name: "production",
    namespace: "neuroloom-production",
    prefix: "production-",
    hosts: ["app.platform.neuroloom.internal", "api.platform.neuroloom.internal", "account.platform.neuroloom.internal"],
  },
];

function renderOverlay(name) {
  const result = spawnSync("kubectl", ["kustomize", path.join("infra", "k8s", "overlays", name)], {
    cwd: platformRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${name} overlay failed to render:\n${result.stderr}`);
  assert.ok(result.stdout.trim().length > 0, `${name} overlay rendered empty output`);
  return result.stdout;
}

function collectImageReferences(rendered) {
  return rendered
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("image: "))
    .map((line) => line.slice("image: ".length).replace(/^['\"]|['\"]$/g, ""));
}

function collectJobNames(rendered) {
  const jobNames = [];
  const documents = rendered.split(/^---\s*$/m);
  for (const document of documents) {
    if (!/^kind:\s*Job\s*$/m.test(document)) continue;
    const name = /^metadata:\s*$[\s\S]*?^  name:\s*(\S+)\s*$/m.exec(document)?.[1];
    if (name) jobNames.push(name);
  }
  return jobNames.sort();
}

test("Kustomize overlays render isolated namespaces and name prefixes without examples, latest tags, or placeholders", () => {
  for (const overlay of overlays) {
    const rendered = renderOverlay(overlay.name);
    assert.match(rendered, new RegExp(`kind: Namespace[\\s\\S]*?name: ${overlay.namespace}`));
    assert.match(rendered, new RegExp(`namespace: ${overlay.namespace}\\b`));
    assert.doesNotMatch(rendered, /^\s*namespace:\s+neuroloom\s*$/m);
    assert.doesNotMatch(rendered, /\bexample\.(?:com|test)\b|ghcr\.io\/example|replace-me|:latest\b/);
    for (const host of overlay.hosts) assert.match(rendered, new RegExp(`host: ${host.replaceAll(".", "\\.")}`));
    assert.match(rendered, new RegExp(`name: ${overlay.prefix}neuroloom-web\\b`));
    assert.match(rendered, new RegExp(`name: ${overlay.prefix}neuroloom-core\\b`));
    assert.match(rendered, new RegExp(`name: ${overlay.prefix}account-traefik\\b`));
    assert.match(rendered, new RegExp(`http://${overlay.prefix}neuroloom-core:4000`));
    assert.doesNotMatch(rendered, /http:\/\/neuroloom-/);
  }
});

test("Kustomize overlays pin every runtime image by digest", () => {
  for (const overlay of overlays) {
    const images = collectImageReferences(renderOverlay(overlay.name));
    assert.ok(images.length >= 8, `${overlay.name} should render application, job, cron, and edge images`);
    for (const image of images) {
      assert.match(image, /@sha256:[a-f0-9]{64}$/i, `${overlay.name} image is not digest pinned: ${image}`);
      assert.doesNotMatch(image, /:latest\b/, `${overlay.name} image still uses latest: ${image}`);
    }
  }
});

test("Kustomize base includes deterministic migration jobs for every database domain", () => {
  for (const overlay of overlays) {
    const rendered = renderOverlay(overlay.name);
    assert.deepEqual(collectJobNames(rendered), [
      `${overlay.prefix}neuroloom-account-domain-migrate`,
      `${overlay.prefix}neuroloom-core-migrate`,
      `${overlay.prefix}neuroloom-gateway-domain-migrate`,
    ]);
    assert.match(rendered, /npm run db:migrate --workspace @neuro\/core/);
    assert.match(rendered, /npm run db:migrate --workspace @neuro\/account-domain/);
    assert.match(rendered, /npm run db:migrate --workspace @neuro\/ai-gateway-domain/);
    assert.match(rendered, /ttlSecondsAfterFinished: 86400/);
    assert.match(rendered, /restartPolicy: Never/);
  }
});

test("account edge RBAC stays namespace scoped and cannot read secrets", () => {
  for (const overlay of overlays) {
    const rendered = renderOverlay(overlay.name);
    assert.doesNotMatch(rendered, /^kind:\s*ClusterRole\s*$/m);
    assert.doesNotMatch(rendered, /^kind:\s*ClusterRoleBinding\s*$/m);
    assert.match(rendered, /^kind:\s*Role\s*$/m);
    assert.match(rendered, /^kind:\s*RoleBinding\s*$/m);
    assert.doesNotMatch(rendered, /resources:\s*\[[^\]]*secrets[^\]]*\]/i);
    assert.doesNotMatch(rendered, /^\s*-\s*secrets\s*$/im);
  }
});

test("Gateway secret contract is explicit without embedding deploy-time placeholder values", async () => {
  const template = await readFile(path.join(platformRoot, "infra", "k8s", "templates", "secrets.example.yaml"), "utf8");
  assert.doesNotMatch(template, /replace-me|example\.com|namespace:\s+neuroloom\b/);
  for (const secret of [
    "neuroloom-account-api-secret",
    "neuroloom-gateway-secret",
    "neuroloom-account-worker-secret",
    "neuroloom-web-secret",
    "neuroloom-core-secret",
    "neuroloom-worker-secret",
    "neuroloom-executor-secret",
    "neuroloom-account-edge-tls",
  ]) {
    assert.match(template, new RegExp(`name: ${secret}\\b`));
  }
  for (const key of [
    "AI_GATEWAY_DATABASE_URL",
    "AI_GATEWAY_REDIS_URL",
    "AI_GATEWAY_API_KEY_SECRET",
    "AI_GATEWAY_PUBLIC_BASE_URL",
    "AI_GATEWAY_COMPATIBILITY_BASE_URL",
    "GATEWAY_MANAGEMENT_TOKEN",
  ]) {
    assert.match(template, new RegExp(`\\b${key}:\\s*\"\"`));
  }
});

test("deploy helper renders, blocks placeholders, waits migrations and rollout, then smokes in-cluster", async () => {
  const script = await readFile(path.join(platformRoot, "deploy", "apply-k8s.sh"), "utf8");
  assert.match(script, /kubectl\s+kustomize/);
  assert.match(script, /placeholder/i);
  assert.match(script, /example\\\.com\|replace-me\|ghcr\\\.io\/example\|:latest/);
  assert.match(script, /NAME_PREFIX/);
  assert.match(script, /kubectl\s+wait[^\n]+condition=complete[^\n]+job\//);
  assert.match(script, /kubectl\s+rollout\s+status/);
  assert.match(script, /curlimages\/curl/);
  assert.match(script, /\$\{NAME_PREFIX\}neuroloom-core/);
  assert.match(script, /neuroloom-gateway-secret/);
});

test("Kustomize Platform-owned image repositories match the Container Images workflow contract", () => {
  for (const overlay of overlays) {
    const images = collectImageReferences(renderOverlay(overlay.name));
    for (const image of PLATFORM_CONTAINER_IMAGES) {
      const expectedPrefix = `ghcr.io/aiaimimi0920/neuro-platform-${image}@sha256:`;
      assert.ok(
        images.some((reference) => reference.startsWith(expectedPrefix)),
        `${overlay.name} is missing the published Platform image ${expectedPrefix}`,
      );
      assert.equal(
        images.some((reference) => reference.startsWith(`ghcr.io/aiaimimi0920/neuroloom-platform-${image}@`)),
        false,
        `${overlay.name} still uses the obsolete repository name for ${image}`,
      );
    }
  }
});
