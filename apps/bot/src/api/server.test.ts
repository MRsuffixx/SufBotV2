import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startInternalApi } from './server.js';
import { __resetEnvForTest, loadEnv } from '../config/env.js';

const noop = () => undefined;

function makeLogger() {
  const base = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    child: () => base,
  };
  return base;
}

type Logger = ReturnType<typeof makeLogger>;

function makeContainer() {
  const client = {
    guilds: {
      cache: {
        size: 3,
        reduce: <T>(fn: (acc: T, g: { memberCount: number }) => T, init: T): T => {
          return [{ memberCount: 10 }, { memberCount: 20 }, { memberCount: 30 }].reduce(
            (acc, g) => fn(acc, g),
            init,
          );
        },
        get: (id: string) =>
          id === '1234567890123456789'
            ? {
                id,
                name: 'Test Guild',
                memberCount: 42,
                channels: {
                  cache: new Map<string, unknown>([
                    [
                      '1234567890123456700',
                      { id: '1234567890123456700', name: 'general', isTextBased: () => true, isDMBased: () => false, type: 0 },
                    ],
                    [
                      '1234567890123456701',
                      { id: '1234567890123456701', name: 'voice', isTextBased: () => false, isDMBased: () => false, type: 2 },
                    ],
                  ]),
                },
              }
            : undefined,
      },
    },
    ws: { ping: 17 },
    user: { tag: 'TestBot#0001' },
  } as unknown as import('discord.js').Client;
  const container = {
    client: () => client,
    logger: () => makeLogger(),
  };
  return container as unknown as Parameters<typeof startInternalApi>[0]['container'];
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, () => {
      const addr = probe.address();
      probe.close(() => {
        if (addr && typeof addr === 'object') resolve(addr.port);
        else reject(new Error('No port'));
      });
    });
  });
}

function withEnv(): void {
  process.env.DISCORD_TOKEN = 'ci-placeholder-token-which-is-long-enough';
  process.env.DISCORD_CLIENT_ID = '123456789012345678';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/discord_bot';
  __resetEnvForTest();
  loadEnv();
}

describe('startInternalApi', () => {
  let original: NodeJS.ProcessEnv;
  const servers: import('node:http').Server[] = [];

  beforeEach(() => {
    original = { ...process.env };
  });

  afterEach(async () => {
    process.env = original;
    __resetEnvForTest();
    while (servers.length > 0) {
      const s = servers.pop();
      if (s) await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });

  it('returns null when port is 0', () => {
    withEnv();
    const r = startInternalApi({
      container: makeContainer(),
      port: 0,
      token: 'a'.repeat(32),
      logger: makeLogger() as unknown as Logger & Logger,
    });
    expect(r).toBeNull();
  });

  it('returns null when token is too short', () => {
    withEnv();
    const r = startInternalApi({
      container: makeContainer(),
      port: 12345,
      token: 'short',
      logger: makeLogger() as unknown as Logger & Logger,
    });
    expect(r).toBeNull();
  });

  it('exposes /health without authentication', async () => {
    withEnv();
    const port = await findFreePort();
    const r = startInternalApi({
      container: makeContainer(),
      port,
      token: 'a'.repeat(32),
      logger: makeLogger() as unknown as Logger & Logger,
    });
    expect(r).not.toBeNull();
    if (r) servers.push(r.server);
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('rejects unauthenticated requests to /api/bot/stats', async () => {
    withEnv();
    const port = await findFreePort();
    const r = startInternalApi({
      container: makeContainer(),
      port,
      token: 'a'.repeat(32),
      logger: makeLogger() as unknown as Logger & Logger,
    });
    expect(r).not.toBeNull();
    if (r) servers.push(r.server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bot/stats`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('returns bot stats for authenticated requests', async () => {
    withEnv();
    const port = await findFreePort();
    const token = 'a'.repeat(32);
    const r = startInternalApi({
      container: makeContainer(),
      port,
      token,
      logger: makeLogger() as unknown as Logger & Logger,
    });
    expect(r).not.toBeNull();
    if (r) servers.push(r.server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bot/stats`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { totalGuilds: number; totalUsers: number; latencyMs: number };
    };
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ totalGuilds: 3, totalUsers: 60, latencyMs: 17 });
  });

  it('returns 404 for unknown guilds', async () => {
    withEnv();
    const port = await findFreePort();
    const token = 'a'.repeat(32);
    const r = startInternalApi({
      container: makeContainer(),
      port,
      token,
      logger: makeLogger() as unknown as Logger & Logger,
    });
    if (r) servers.push(r.server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bot/guilds/9999999999999999999/overview`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  it('returns guild overview when the guild is in the cache', async () => {
    withEnv();
    const port = await findFreePort();
    const token = 'a'.repeat(32);
    const r = startInternalApi({
      container: makeContainer(),
      port,
      token,
      logger: makeLogger() as unknown as Logger & Logger,
    });
    if (r) servers.push(r.server);
    const res = await fetch(`http://127.0.0.1:${port}/api/bot/guilds/1234567890123456789/overview`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: {
        guildId: string;
        name: string;
        memberCount: number;
        textChannels?: { id: string; name: string }[];
      };
    };
    expect(body.success).toBe(true);
    expect(body.data.guildId).toBe('1234567890123456789');
    expect(body.data.name).toBe('Test Guild');
    expect(body.data.memberCount).toBe(42);
    expect(body.data.textChannels).toEqual([{ id: '1234567890123456700', name: 'general' }]);
  });
});
