import type Redis from "ioredis";

// Explicit command-boundary simulation for local HTTP/PG tests. This does not
// execute or prove Redis Lua; the isolated Redis integration suite does that.
export class RauthyRateLimitFixture {
  readonly entries = new Map<string, { current: number; expiresAt: number }>();
  readonly calls: string[] = [];
  failure: Error | null = null;
  now = 0;
  readonly redis: Redis;

  constructor() {
    const fixture = this;
    const client = {
      defineCommand(name: string) {
        Object.assign(client, { [name]: (key: string, windowMs: number, _max: number,
          _continue: boolean, _backoff: boolean, callback: (error: Error | null, result?: number[]) => void) => {
          fixture.calls.push(key);
          if (fixture.failure) { callback(fixture.failure); return; }
          const previous = fixture.entries.get(key);
          const row = previous && previous.expiresAt > fixture.now ? previous : { current: 0, expiresAt: fixture.now + windowMs };
          row.current++;
          fixture.entries.set(key, row);
          callback(null, [row.current, row.expiresAt - fixture.now]);
        } });
      },
    };
    this.redis = client as unknown as Redis;
  }
}
