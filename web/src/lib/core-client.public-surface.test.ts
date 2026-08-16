import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const clientDir = new URL("./core-client/", import.meta.url);
const facadeSource = readFileSync(new URL("./core-client.ts", import.meta.url), "utf8");
const arbitrationClientSource = readFileSync(new URL("./core-client/arbitration.ts", import.meta.url), "utf8");
const moduleSources = readdirSync(clientDir)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => readFileSync(new URL(name, clientDir), "utf8"))
  .join("\n");
const clientSource = `${facadeSource}\n${moduleSources}`;

test("public surface reads stay strict instead of failing open to an all-enabled snapshot", () => {
  assert.match(clientSource, /export async function getPublicSurfaceSnapshotStrict/);
  assert.doesNotMatch(clientSource, /function availablePublicSurfaceSnapshot/);
  assert.doesNotMatch(clientSource, /export async function getPublicSurfaceSnapshot\(\)/);
});

test("arbitration client encodes every dynamic URL path segment", () => {
  assert.match(arbitrationClientSource, /function encodePathSegment\(value: string\)/);
  assert.doesNotMatch(arbitrationClientSource, /\$\{(?:caseId|evidenceId|attachmentId)\}/);
  assert.match(arbitrationClientSource, /\$\{encodePathSegment\(caseId\)\}/);
  assert.match(arbitrationClientSource, /\$\{encodePathSegment\(evidenceId\)\}/);
  assert.match(arbitrationClientSource, /\$\{encodePathSegment\(attachmentId\)\}/);
});
