import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { URL } from "node:url";

export async function postInternalJson(endpoint: string, token: string, body?: unknown) {
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol for executor endpoint: ${parsed.protocol}`);
  }

  const requestFn = parsed.protocol === "https:" ? httpsRequest : httpRequest;
  const payload = body ? JSON.stringify(body) : undefined;

  await new Promise<void>((resolve, reject) => {
    const req = requestFn(
      {
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : undefined,
        path: `${parsed.pathname}${parsed.search}`,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload).toString() } : {}),
          "x-internal-api-token": token,
        },
      },
      (res) => {
        const { statusCode } = res;
        if (statusCode && statusCode >= 200 && statusCode < 300) {
          res.resume();
          resolve();
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer | Uint8Array) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on("end", () => {
          const responseBody = Buffer.concat(chunks).toString("utf8");
          reject(
            new Error(
              `Executor endpoint returned ${statusCode ?? "unknown"}${responseBody ? `: ${responseBody}` : ""}`,
            ),
          );
        });
      },
    );

    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}
