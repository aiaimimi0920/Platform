import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testFilePath = fileURLToPath(import.meta.url);
const platformRoot = path.resolve(path.dirname(testFilePath), "../../..");
const environments = [
  {
    name: "staging",
    prefix: "neuroloom-staging",
    subnetCidr: "10.42.0.0/20",
    statePrefix: "platform/staging",
    nodeNames: ["k3s-server-1", "k3s-agent-1", "data-1"],
  },
  {
    name: "production",
    prefix: "neuroloom-prod",
    subnetCidr: "10.52.0.0/20",
    statePrefix: "platform/production",
    nodeNames: ["k3s-server-1", "k3s-agent-1", "k3s-agent-2", "data-1", "data-2"],
  },
];

function read(relativePath) {
  return readFileSync(path.join(platformRoot, relativePath), "utf8");
}

function extractBlock(source, kind, name) {
  const marker = `${kind} "${name}"`;
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing ${marker}`);
  const start = source.indexOf("{", markerIndex + marker.length);
  assert.notEqual(start, -1, `Missing opening brace for ${marker}`);
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start + 1, index);
  }
  assert.fail(`Missing closing brace for ${marker}`);
}

test("OpenTofu environments isolate remote state, names, networks, and node inventories", () => {
  for (const environment of environments) {
    const root = path.join("infra", "tofu", "environments", environment.name);
    for (const file of [
      ".terraform.lock.hcl",
      "backend.tf",
      "backend.hcl.example",
      "main.tf",
      "outputs.tf",
      "variables.tf",
      "versions.tf",
    ]) {
      assert.ok(existsSync(path.join(platformRoot, root, file)), `${environment.name} is missing ${file}`);
    }
    const backend = read(path.join(root, "backend.tf"));
    assert.match(backend, /backend\s+"gcs"\s*\{/);
    assert.match(backend, new RegExp(`prefix\\s*=\\s*"${environment.statePrefix}"`));
    assert.doesNotMatch(backend, /\bbucket\s*=|credentials\s*=/);

    const providerLock = read(path.join(root, ".terraform.lock.hcl"));
    assert.match(providerLock, /registry\.opentofu\.org\/cloudflare\/cloudflare/);
    assert.match(providerLock, /registry\.opentofu\.org\/hashicorp\/google/);
    assert.doesNotMatch(providerLock, /registry\.opentofu\.org\/hashicorp\/cloudflare/);

    const main = read(path.join(root, "main.tf"));
    assert.match(main, new RegExp(`prefix\\s*=\\s*"${environment.prefix}"`));
    for (const nodeName of environment.nodeNames) {
      assert.match(main, new RegExp(`"\\$\\{local\\.prefix\\}-${nodeName}"`));
    }
    const variables = read(path.join(root, "variables.tf"));
    assert.match(variables, new RegExp(`default\\s*=\\s*"${environment.subnetCidr.replaceAll(".", "\\.")}"`));
  }
  assert.notEqual(environments[0].prefix, environments[1].prefix);
  assert.notEqual(environments[0].subnetCidr, environments[1].subnetCidr);
  assert.notEqual(environments[0].statePrefix, environments[1].statePrefix);
});

test("OpenTofu required and secret inputs fail closed without deployable defaults", () => {
  for (const environment of environments) {
    const root = path.join("infra", "tofu", "environments", environment.name);
    const variables = read(path.join(root, "variables.tf"));
    for (const variableName of [
      "project_id",
      "cloudflare_api_token",
      "cloudflare_zone_id",
      "root_domain",
      "files_cname_target",
    ]) {
      const block = extractBlock(variables, "variable", variableName);
      assert.doesNotMatch(block, /^\s*default\s*=/m, `${environment.name}.${variableName} must not have a default`);
      assert.match(block, /validation\s*\{/, `${environment.name}.${variableName} must validate input`);
    }
    assert.match(extractBlock(variables, "variable", "cloudflare_api_token"), /sensitive\s*=\s*true/);
    for (const rangeVariable of ["ssh_source_ranges", "ingress_source_ranges"]) {
      const block = extractBlock(variables, "variable", rangeVariable);
      assert.match(block, /0\.0\.0\.0\/0/);
      assert.match(block, /::\/0/);
    }

    const examplePath = path.join(root, "terraform.tfvars.example");
    const example = read(examplePath);
    assert.match(example, /replace-with-cloudflare-api-token/);
    assert.match(example, /example\.com/);
    assert.ok(!examplePath.endsWith("terraform.tfvars"));
    assert.ok(!examplePath.endsWith(".auto.tfvars"));
  }
});

test("OpenTofu environment outputs expose non-secret deployment inputs for k3s and Cloudflare", () => {
  const requiredOutputs = [
    "environment",
    "network_self_link",
    "subnet_self_link",
    "control_plane_public_ipv4",
    "control_plane_private_ipv4",
    "node_private_ips",
    "node_public_ips",
    "data_disk_ids",
    "node_service_account_email",
    "dns_hostnames",
    "dns_record_ids",
    "dns_targets",
  ];
  for (const environment of environments) {
    const outputs = read(path.join("infra", "tofu", "environments", environment.name, "outputs.tf"));
    for (const outputName of requiredOutputs) extractBlock(outputs, "output", outputName);
    assert.doesNotMatch(outputs, /cloudflare_api_token|credentials|private_key|kubeconfig/i);
  }
});

test("OpenTofu modules constrain east-west traffic and harden nodes and DNS defaults", () => {
  const networkMain = read("infra/tofu/modules/gcp-network/main.tf");
  const internalFirewall = extractBlock(networkMain, "resource", 'google_compute_firewall" "internal');
  assert.match(internalFirewall, /ports\s*=\s*var\.internal_tcp_ports/);
  assert.match(internalFirewall, /ports\s*=\s*var\.internal_udp_ports/);
  assert.match(internalFirewall, /target_tags\s*=\s*var\.internal_target_tags/);
  assert.doesNotMatch(internalFirewall, /protocol\s*=\s*"(?:tcp|udp)"\s*\}/);

  const networkVariables = read("infra/tofu/modules/gcp-network/variables.tf");
  for (const rangeVariable of ["ssh_source_ranges", "ingress_source_ranges"]) {
    const block = extractBlock(networkVariables, "variable", rangeVariable);
    assert.match(block, /0\.0\.0\.0\/0/);
    assert.match(block, /::\/0/);
  }

  const nodeMain = read("infra/tofu/modules/gcp-nodes/main.tf");
  assert.match(nodeMain, /resource\s+"google_service_account"/);
  assert.match(nodeMain, /resource\s+"google_compute_disk"\s+"data"/);
  assert.match(nodeMain, /dynamic\s+"attached_disk"/);
  assert.match(nodeMain, /shielded_instance_config\s*\{/);
  assert.match(nodeMain, /enable-oslogin/);
  assert.match(nodeMain, /block-project-ssh-keys/);
  assert.match(nodeMain, /"platform-role"\s*=\s*each\.value\.role/);
  assert.doesNotMatch(nodeMain, /each\.value\.metadata/);
  assert.match(nodeMain, /startswith\(each\.value\.zone, "\$\{var\.region\}-"\)/);

  const dnsMain = read("infra/tofu/modules/cloudflare-dns/main.tf");
  assert.equal((dnsMain.match(/ttl\s*=\s*var\.proxied\s*\?\s*1\s*:\s*var\.unproxied_ttl/g) ?? []).length, 3);
  const dnsOutputs = read("infra/tofu/modules/cloudflare-dns/outputs.tf");
  for (const outputName of ["hostnames", "record_ids", "targets"]) extractBlock(dnsOutputs, "output", outputName);
  assert.match(read("infra/tofu/modules/cloudflare-dns/versions.tf"), /source\s*=\s*"cloudflare\/cloudflare"/);
});

test("Platform exposes deterministic OpenTofu format and validation gates", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.scripts?.["infra:tofu:validate"], "node scripts/validate-tofu.mjs");
  assert.match(packageJson.scripts?.ci ?? "", /tofu-contract\.test\.mjs/);

  const runner = read("scripts/validate-tofu.mjs");
  assert.match(runner, /fmt/);
  assert.match(runner, /-check/);
  assert.match(runner, /-recursive/);
  assert.match(runner, /init/);
  assert.match(runner, /-backend=false/);
  assert.match(runner, /validate/);
  assert.match(runner, /TF_DATA_DIR/);

  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /opentofu\/setup-opentofu@v2/);
  assert.match(workflow, /tofu_version_file:\s*\.opentofu-version/);
  assert.match(workflow, /npm run infra:tofu:validate/);
});
