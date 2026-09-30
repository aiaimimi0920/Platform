// Isolated account fixture for real two-host Hook UI checks; no production OAuth.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import Redis from 'ioredis';
import { ProjectionRuntime, object } from '../../../Loom/scripts/qr-projection-smoke/runtime.ts';
import { RemoteProjectionRuntime } from './loom-remote-projection-runtime.ts';
import { LoomAccountRepository } from '../../packages/account-domain/src/modules/loom-account/repository.ts';
import { LoomAccountService } from '../../packages/account-domain/src/modules/loom-account/service.ts';
import { LoomAccountError } from '../../packages/account-domain/src/modules/loom-account/model.ts';
import { LoomProjectionRepository } from '../../packages/account-domain/src/modules/loom-projection/repository.ts';
import { LoomProjectionService } from '../../packages/account-domain/src/modules/loom-projection/service.ts';
import { LoomProjectionError } from '../../packages/account-domain/src/modules/loom-projection/model.ts';
import { projectionPolicy } from '../../packages/account-domain/src/modules/loom-projection/policy.ts';
import { parseLoomAccountAuthorization } from '../../web/src/lib/loom-account-authorization.ts';
import { handleLoomAccountRequest } from '../../web/src/lib/loom-account-handlers.ts';
import { handleLoomProjectionRequest } from '../../web/src/lib/loom-projection-handlers.ts';

async function main(): Promise<void> {
  const executable = process.env.LOOM_ACCOUNT_TEST_DAEMON!;
  const redisUrl = process.env.LOOM_ACCOUNT_TEST_REDIS_URL!;
  const output = resolve(process.env.HOOK_GUI_FIXTURE_OUTPUT!);
  assert.ok(existsSync(executable) && redisUrl.startsWith('redis://127.0.0.1:'));
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  const service = new LoomAccountService(new LoomAccountRepository(redis));
  const signal = AbortSignal.timeout(30 * 60_000);
  const a = new ProjectionRuntime(executable, signal);
  const b = new RemoteProjectionRuntime(executable, signal);
  let origin = '';
  const projections = new LoomProjectionService(new LoomProjectionRepository(redis), service, () => projectionPolicy(origin, []));
  const server = createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length; assert.ok(bytes <= 16384); chunks.push(chunk);
      }
      const request = new Request(origin + req.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: Buffer.concat(chunks) });
      let result: Response;
      if (req.url === '/api/loom/projections') {
        result = await handleLoomProjectionRequest(request, async (_path, { body }) => {
          assert.ok(!String(object(body).payload).includes('imageBase64'));
          try { return await projections.execute(body); }
          catch (error) {
            if (error instanceof LoomAccountError || error instanceof LoomProjectionError) throw { status: error.statusCode, code: error.code };
            throw error;
          }
        });
      } else {
        const action = req.url?.split('/').at(-1) || '';
        result = await handleLoomAccountRequest(request, action, async (_path, { body }) => {
          try {
            if (action === 'exchange') return await service.exchange(body);
            assert.ok(action === 'status' || action === 'revoke');
            return await service.prove(action, body);
          } catch (error) {
            if (error instanceof LoomAccountError) throw { status: error.statusCode, code: error.code };
            throw error;
          }
        });
      }
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text());
    } catch { res.writeHead(500); res.end('{"error":"fixture_failed"}'); }
  });
  try {
    mkdirSync(output, { recursive: true });
    assert.ok(!existsSync(resolve(output, 'ready.json')), 'Use a fresh fixture output directory');
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    const address = server.address(); assert.ok(address && typeof address === 'object');
    origin = 'http://127.0.0.1:' + address.port;
    await b.prepare(origin);
    await Promise.all([a.start(), b.start()]);
    for (const [runtime, name] of [[a, 'Hook GUI local'], [b, 'Hook GUI PC3']] as const) {
      const headers = { Authorization: 'Bearer ' + runtime.adminToken };
      const pending = (await runtime.request('/v1/account/start', { origin, deviceName: name }, headers)).body;
      const grant = parseLoomAccountAuthorization(Object.fromEntries(new URL(String(pending.authorizationUrl)).searchParams));
      assert.ok(grant);
      await service.approve(grant, { userId: 'hook-gui-isolated-account', username: 'Hook GUI fixture' });
      await delay(5100, undefined, { signal });
      const signed = await runtime.request('/v1/account/poll', { requestId: pending.requestId }, headers);
      assert.equal(signed.body.status, 'signed_in');
    }
    writeFileSync(resolve(output, 'ready.json'), JSON.stringify({ localOrigin: a.origin, remoteOrigin: b.origin, remoteHost: b.evidence.host, daemonSha256: b.evidence.daemonSha256 }), 'utf8');
    console.log('GUI fixture ready; both isolated Loom accounts signed in');
    // Auto-approve only devices submitted to these disposable test daemons.
    while (!existsSync(resolve(output, 'stop.signal'))) {
      signal.throwIfAborted();
      for (const runtime of [a, b]) {
        const headers = { Authorization: 'Bearer ' + runtime.adminToken };
        const view = await runtime.request('/v1/devices', undefined, headers);
        if (Array.isArray(view.body.pending)) for (const item of view.body.pending) {
          const id = String(object(item).id); assert.match(id, /^[A-Za-z0-9._:-]+$/);
          const approved = await runtime.request('/v1/devices/' + id + '/approve', {}, headers);
          assert.equal(approved.status, 200);
        }
      }
      await delay(1000, undefined, { signal });
    }
  } finally {
    const cleanup = await Promise.allSettled([a.dispose(), b.dispose()]);
    server.closeAllConnections(); await new Promise<void>(done => server.close(() => done()));
    redis.disconnect();
    assert.ok(cleanup.every(item => item.status === 'fulfilled'), 'Owned daemon cleanup failed');
  }
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'GUI fixture failed');
  process.exitCode = 1;
});
