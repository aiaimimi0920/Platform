// Owns one disposable Redis container; never attaches to a developer database.
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const { values } = parseArgs({ options: { daemon: { type: "string" }, projection: { type: "boolean", default: false } } });
if (values.projection && !values.daemon) throw new Error("--projection requires --daemon");
const tests = values.daemon ? ["scripts/testing/loom-account-native-smoke.ts"] : [
  "packages/account-domain/src/modules/loom-account/login.integration.test.ts",
  "packages/account-domain/src/modules/loom-projection/tests/lifecycle.integration.test.ts",
  "packages/account-domain/src/modules/loom-projection/tests/authorization.integration.test.ts",
  "packages/account-domain/src/modules/loom-projection/tests/discovery.integration.test.ts",
  "web/src/lib/loom-account-handlers.test.ts",
  "web/src/lib/loom-projection-handlers.test.ts",
];
const name = `loom-account-test-${randomUUID().slice(0, 8)}`;
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 }).trim();
let owned = false;
try {
  docker("run", "-d", "--rm", "--name", name, "-p", "127.0.0.1::6379", "redis:8-alpine", "redis-server", "--save", "", "--appendonly", "no");
  owned = true;
  const ports = JSON.parse(docker("inspect", "--format", "{{json .NetworkSettings.Ports}}", name));
  const port = Number(ports["6379/tcp"][0].HostPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid isolated Redis port");
  docker("exec", name, "redis-cli", "ping");
  const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...tests], {
    cwd: root, stdio: "inherit", timeout: process.env.LOOM_TEST_SSH_CONFIG ? 300_000 : values.projection ? 180_000 : 120_000,
    env: { ...process.env, LOOM_ACCOUNT_TEST_REDIS_URL: `redis://127.0.0.1:${port}`,
      LOOM_ACCOUNT_TEST_DAEMON: values.daemon ? resolve(values.daemon) : "", LOOM_PROJECTION_TEST: values.projection ? "1" : "" },
  });
  process.exitCode = result.status ?? 1;
} finally {
  if (owned) docker("rm", "-f", name);
}
