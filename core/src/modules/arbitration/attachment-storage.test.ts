import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
process.env.INTERNAL_API_TOKEN ??= "test-internal-token";

test("arbitration attachment uploads accept canonical padded and unpadded base64", async () => {
  const { decodeArbitrationAttachmentBase64 } = await import("./service/attachment-storage");

  assert.equal(decodeArbitrationAttachmentBase64("aGVsbG8=").toString("utf8"), "hello");
  assert.equal(decodeArbitrationAttachmentBase64("aGVsbG8").toString("utf8"), "hello");
});

test("arbitration attachment uploads reject malformed or non-canonical base64", async () => {
  const { decodeArbitrationAttachmentBase64 } = await import("./service/attachment-storage");

  for (const input of ["aGVsbG8$", "aGVsbG8===", "a=GVsbG8", "A", "Zh=="]) {
    assert.throws(
      () => decodeArbitrationAttachmentBase64(input),
      /Attachment payload is not valid base64/,
      input,
    );
  }
});

test("empty attachment payload remains distinguishable from malformed base64", async () => {
  const { normalizeAttachmentUpload } = await import("./service/attachment-storage");

  assert.throws(
    () => normalizeAttachmentUpload({ fileName: "empty.txt", contentType: "text/plain", base64Content: "" }),
    /Attachment payload is empty/,
  );
});
