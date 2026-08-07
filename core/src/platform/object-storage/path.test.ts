import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveObjectStoragePath } from "./path";

test("resolveObjectStoragePath keeps safe keys below the storage root", () => {
  const root = path.resolve("runtime", "objects");
  assert.equal(
    resolveObjectStoragePath(root, "arbitration/case-1/file.txt"),
    path.join(root, "arbitration", "case-1", "file.txt"),
  );
});

test("resolveObjectStoragePath rejects traversal and absolute keys", () => {
  const root = path.resolve("runtime", "objects");
  for (const key of ["../outside.txt", "case/../outside.txt", path.resolve("outside.txt"), "/outside.txt", ""]) {
    assert.throws(() => resolveObjectStoragePath(root, key), /safe relative path/);
  }
});
