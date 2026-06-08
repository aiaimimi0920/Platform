import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const gatewayOpsDir = fileURLToPath(new URL(".", import.meta.url));

function listTsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listTsxFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

test("gateway ops pages use the shared nt-btn button class", () => {
  const offenders = listTsxFiles(gatewayOpsDir)
    .filter((file) => readFileSync(file, "utf8").includes('className="nt-button"'))
    .map((file) => file.replace(gatewayOpsDir, ""));

  assert.deepEqual(offenders, []);
});
