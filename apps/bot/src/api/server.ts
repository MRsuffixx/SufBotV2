import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from 'node:http';
import { BotStatsResponseSchema, GuildOverviewResponseSchema, SnowflakeSchema } from '@bot/shared';
import { botStatsService } from '../services/bot-stats.service.js';
import type { BotContainer } from '../core/container.js';
import type { Logger } from '../utils/logger.js';

const VERSION = '0.1.0';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function ok<T>(data: T): ApiEnvelope<T> {
  return { success: true, data };
}

function fail(error: string): ApiEnvelope<never> {
  return { success: false, error };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * Compare a constant-time credential with a candidate.  Always processes
 * the full length of both strings so a successful comparison does not
 * reveal information about how many characters of the token matched.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function isAuthorized(req: IncomingMessage, token: string): boolean {
  const header = req.headers['authorization'];
  if (!header) return false;
  const expected = `Bearer ${token}`;
  return constantTimeEquals(header, expected);
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > 16 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export interface InternalApiDeps {
  container: BotContainer;
  port: number;
  token: string;
  logger: Logger;
}

/**
 * Start the internal HTTP API.  Returns a shutdown function.
 *
 * Endpoints (all require `Authorization: Bearer <INTERNAL_API_TOKEN>`):
 *   GET  /health           -> liveness
 *   GET  /api/bot/stats    -> global bot stats
 *   GET  /api/bot/guilds/:id/overview -> per-guild overview
 */
export function startInternalApi(deps: InternalApiDeps): { server: Server; port: number } | null {
  const { container, port, token, logger } = deps;
  if (port === 0) {
    logger.info('internal_api_disabled');
    return null;
  }
  if (token.length < 16) {
    logger.warn('internal_api_token_too_short');
    return null;
  }

  const log = logger.child({ component: 'internal-api' });
  const client = container.client();

  const server = createServer(async (req, res) => {
    const startedAt = Date.now();
    try {
      if (!req.url || !req.method) {
        return send(res, 400, fail('Bad request'));
      }
      if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('allow', 'GET, POST');
        return send(res, 405, fail('Method not allowed'));
      }

      // Health check is unauthenticated (probes don't have a token).
      if (req.url === '/health' && req.method === 'GET') {
        return send(res, 200, ok({ status: 'ok' }));
      }

      if (!isAuthorized(req, token)) {
        return send(res, 401, fail('Unauthorized'));
      }

      // POST endpoints accept JSON bodies for future mutations; for now
      // we only read them to keep them warm.
      if (req.method === 'POST') {
        await readJson(req).catch(() => undefined);
      }

      if (req.url === '/api/bot/stats' && req.method === 'GET') {
        const stats = botStatsService.collect(client, VERSION);
        const parsed = BotStatsResponseSchema.safeParse(stats);
        if (!parsed.success) {
          log.error('stats_validation_failed', parsed.error);
          return send(res, 500, fail('Failed to build stats'));
        }
        return send(res, 200, ok(parsed.data));
      }

      const guildMatch = /^\/api\/bot\/guilds\/([^/]+)\/overview$/.exec(req.url);
      if (guildMatch && req.method === 'GET') {
        const [, rawId] = guildMatch;
        if (!rawId || !SnowflakeSchema.safeParse(rawId).success) {
          return send(res, 400, fail('Invalid guild id'));
        }
        const guild = client.guilds.cache.get(rawId);
        if (!guild) {
          return send(res, 404, fail('Guild not found in bot cache'));
        }
        const textChannels: { id: string; name: string }[] = [];
        for (const [, ch] of guild.channels.cache) {
          if (ch.isTextBased() && !ch.isDMBased() && ch.type === 0 /* GuildText */) {
            textChannels.push({ id: ch.id, name: ch.name });
          }
        }
        const data = {
          guildId: guild.id,
          name: guild.name,
          memberCount: guild.memberCount ?? 0,
          botLatencyMs: client.ws.ping,
          uptimeSeconds: Math.floor((Date.now() - botStatsService.startedAt().getTime()) / 1000),
          textChannels,
        };
        const parsed = GuildOverviewResponseSchema.safeParse(data);
        if (!parsed.success) {
          log.error('overview_validation_failed', parsed.error);
          return send(res, 500, fail('Failed to build overview'));
        }
        return send(res, 200, ok(parsed.data));
      }

      return send(res, 404, fail('Not found'));
    } catch (err) {
      log.error('internal_api_error', err);
      return send(res, 500, fail('Internal error'));
    } finally {
      const ms = Date.now() - startedAt;
      log.debug('request', { method: req.method, url: req.url, ms });
    }
  });

  server.listen(port, '0.0.0.0', () => {
    log.info(`listening on :${port}`);
  });

  return { server, port };
}
