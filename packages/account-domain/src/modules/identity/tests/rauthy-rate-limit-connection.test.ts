import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

import Redis from "ioredis";

import { createRauthyRateLimitConnection } from "../rauthy-rate-limit";

function parseCommand(buffer: string) {
  const header = /^\*(\d+)\r\n/.exec(buffer);
  if (!header) return null;
  let offset = header[0].length;
  const args: string[] = [];
  for (let n = 0; n < Number(header[1]); n++) {
    const length = /^\$(\d+)\r\n/.exec(buffer.slice(offset));
    if (!length) return null;
    offset += length[0].length;
    if (buffer.length < offset + Number(length[1]) + 2) return null;
    args.push(buffer.slice(offset, offset + Number(length[1])));
    offset += Number(length[1]) + 2;
  }
  return { args, consumed: offset };
}

async function startBlackhole(handshake: boolean) {
  const sockets = new Set<Socket>();
  let connections = 0;
  const server = createServer((socket) => {
    connections++;
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let pending = "";
    socket.on("data", (chunk) => {
      pending += chunk.toString("utf8");
      for (;;) {
        const command = parseCommand(pending);
        if (!command) return;
        pending = pending.slice(command.consumed);
        if (!handshake) continue;
        if (command.args[0].toUpperCase() === "INFO") {
          const payload = "redis_version:7.2.0\r\nloading:0\r\n";
          socket.write(`$${Buffer.byteLength(payload)}\r\n${payload}\r\n`);
        } else if (command.args[0].toUpperCase() === "CLIENT") {
          socket.write("+OK\r\n");
        }
        // After the genuine ioredis handshake, never answer commands.
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    url: `redis://127.0.0.1:${address.port}`,
    connections: () => connections,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test("Rauthy lazy connection has a bounded handshake deadline", { timeout: 5000 }, async (t) => {
  const blackhole = await startBlackhole(false);
  const base = new Redis(blackhole.url, { lazyConnect: true });
  const connection = createRauthyRateLimitConnection(base);
  t.after(async () => { connection.close(); base.disconnect(); await blackhole.close(); });
  assert.equal(connection.redis.status, "wait");
  assert.equal(blackhole.connections(), 0);
  const started = Date.now();
  await assert.rejects(connection.ready(), { statusCode: 503 });
  assert.ok(Date.now() - started < 2500);
});

test("Rauthy ready socket blackhole closes the connection and flushes pending commands", { timeout: 5000 }, async (t) => {
  const blackhole = await startBlackhole(true);
  const base = new Redis(blackhole.url, { lazyConnect: true });
  const connection = createRauthyRateLimitConnection(base);
  t.after(async () => { connection.close(); base.disconnect(); await blackhole.close(); });
  await Promise.all(Array.from({ length: 5 }, () => connection.ready()));
  assert.equal(blackhole.connections(), 1, "Concurrent first calls share one connection attempt");
  assert.equal(connection.redis.status, "ready");
  await assert.rejects(connection.redis.ping());
  const deadline = Date.now() + 1500;
  const status = () => connection.redis.status;
  while (status() !== "end" && Date.now() < deadline) await delay(10);
  assert.equal(connection.redis.status, "end");
  assert.equal(connection.redis.commandQueue.length, 0);
  assert.equal(base.status, "wait");
});
