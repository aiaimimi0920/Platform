import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("provider credential detail keeps raw secrets out of the browser surface", async () => {
  const [pageSource, clientSource, actionSource] = await Promise.all([
    readFile(path.resolve(__dirname, "[providerAccountId]/page.tsx"), "utf8"),
    readFile(path.resolve(__dirname, "provider-credential-browser-client.tsx"), "utf8"),
    readFile(path.resolve(__dirname, "[providerAccountId]/credentials/actions.ts"), "utf8"),
  ]);

  assert.match(pageSource, /maskSecrets:\s*true/);
  assert.doesNotMatch(pageSource, /maskSecrets:\s*false/);
  assert.doesNotMatch(clientSource, /下载凭证/);
  assert.doesNotMatch(clientSource, /name="credentialJson"/);
  assert.match(clientSource, /认证文件 JSON \(脱敏预览\)/);
  assert.match(actionSource, /\.\.\.\(credentialPayload \? \{ credential: credentialPayload \} : \{\}\)/);
});
