import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import path from "node:path";

import { assertDevAuthConfiguration } from "./dev-auth";

describe("production dev auth guard", () => {
  it("rejects an enabled bypass in production", () => {
    assert.throws(
      () =>
        assertDevAuthConfiguration({
          NODE_ENV: "production",
          DEV_AUTH_BYPASS_ENABLED: "true",
        }),
      /DEV_AUTH_BYPASS_ENABLED.*production/i,
    );
  });

  it("allows a disabled production bypass and an enabled development bypass", () => {
    assert.doesNotThrow(() =>
      assertDevAuthConfiguration({
        NODE_ENV: "production",
        DEV_AUTH_BYPASS_ENABLED: "false",
      }),
    );
    assert.doesNotThrow(() =>
      assertDevAuthConfiguration({
        NODE_ENV: "development",
        DEV_AUTH_BYPASS_ENABLED: "true",
      }),
    );
  });

  it("fails auth module startup before a production bypass can register", () => {
    const authModuleUrl = pathToFileURL(path.resolve(process.cwd(), "src/auth.ts")).href;
    const script = [
      `import(${JSON.stringify(authModuleUrl)})`,
      "  .then(() => process.exit(0))",
      "  .catch((error) => {",
      "    console.error(error instanceof Error ? error.message : String(error));",
      "    process.exit(23);",
      "  });",
    ].join("\n");
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        DEV_AUTH_BYPASS_ENABLED: "true",
        OAUTH_CLIENT_ID: "acceptance-client",
        OAUTH_CLIENT_SECRET: "acceptance-secret",
        NEXTAUTH_SECRET: "acceptance-nextauth-secret",
      },
    });

    assert.equal(result.status, 23, result.stderr || result.stdout);
    assert.match(result.stderr, /DEV_AUTH_BYPASS_ENABLED.*production/i);
  });

  it("fails Next startup configuration before serving a production bypass", () => {
    const configModuleUrl = pathToFileURL(path.resolve(process.cwd(), "next.config.ts")).href;
    const script = [
      `import(${JSON.stringify(configModuleUrl)})`,
      "  .then(() => process.exit(0))",
      "  .catch((error) => {",
      "    console.error(error instanceof Error ? error.message : String(error));",
      "    process.exit(23);",
      "  });",
    ].join("\n");
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        DEV_AUTH_BYPASS_ENABLED: "true",
      },
    });

    assert.equal(result.status, 23, result.stderr || result.stdout);
    assert.match(result.stderr, /DEV_AUTH_BYPASS_ENABLED.*production/i);
  });
});
