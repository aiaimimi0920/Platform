import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";

import { postInternalJson } from "./http";

describe("postInternalJson", () => {
  it("sends POST requests with the executor JSON and auth headers", async (t) => {
    let capturedRequest:
      | {
          method?: string;
          url?: string;
          headers: http.IncomingHttpHeaders;
          body: string;
        }
      | undefined;

    const server = http.createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      capturedRequest = {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      };

      response.writeHead(204).end();
    });

    t.after(() => server.close());
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const payload = { limit: 18, minimumAlertLevel: 8 };

    await postInternalJson(
      `http://127.0.0.1:${port}/v1/internal/agent-executions/runtime-alerts/emit-alerts?dryRun=1`,
      "internal-token",
      payload,
    );

    assert.ok(capturedRequest);
    assert.equal(capturedRequest.method, "POST");
    assert.equal(capturedRequest.url, "/v1/internal/agent-executions/runtime-alerts/emit-alerts?dryRun=1");
    assert.equal(capturedRequest.headers.accept, "application/json");
    assert.equal(capturedRequest.headers["content-type"], "application/json");
    assert.equal(capturedRequest.headers["x-internal-api-token"], "internal-token");
    assert.equal(capturedRequest.headers["content-length"], Buffer.byteLength(JSON.stringify(payload)).toString());
    assert.equal(capturedRequest.body, JSON.stringify(payload));
  });

  it("rejects unsupported endpoint protocols", async () => {
    await assert.rejects(
      postInternalJson("ftp://core.internal/v1/internal/agent-executions/run-platform-executor", "token"),
      /Unsupported protocol for executor endpoint: ftp:/,
    );
  });

  it("surfaces non-2xx responses with status code and body text", async (t) => {
    const server = http.createServer((request, response) => {
      assert.equal(request.method, "POST");
      response.writeHead(503, { "content-type": "text/plain" });
      response.end("core unavailable");
    });

    t.after(() => server.close());
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;

    await assert.rejects(
      postInternalJson(`http://127.0.0.1:${port}/v1/internal/agent-executions/run-platform-executor`, "token", {
        limit: 3,
      }),
      /Executor endpoint returned 503: core unavailable/,
    );
  });
});
