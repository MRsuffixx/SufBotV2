import { z } from 'zod';
import { BotStatsResponseSchema, GuildOverviewResponseSchema, type BotStatsResponse, type GuildOverviewResponse } from '@bot/shared';
import { getWebEnv } from './env';
import type { ApiResponse } from './api-response';
import { ok, fail } from './api-response';

const ErrorEnvelopeSchema = z.object({ success: z.literal(false), error: z.string() });

async function botFetch<T>(path: string, schema: z.ZodType<T>): Promise<ApiResponse<T>> {
  const env = getWebEnv();
  const url = `${env.BOT_API_BASE_URL.replace(/\/$/u, '')}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { authorization: `Bearer ${env.INTERNAL_API_TOKEN}` },
      // Cache for at most a second to keep latency low without hammering
      // the bot on every render.
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Bot API unreachable');
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return fail(`Bot API returned non-JSON (status ${res.status})`);
  }
  if (!res.ok) {
    const parsed = ErrorEnvelopeSchema.safeParse(json);
    return fail(parsed.success ? parsed.data.error : `Bot API error ${res.status}`);
  }
  const envelope = json as { success?: boolean; data?: unknown };
  if (!envelope.success || envelope.data === undefined) {
    return fail('Malformed bot response');
  }
  const result = schema.safeParse(envelope.data);
  if (!result.success) {
    return fail('Bot API returned an unexpected payload');
  }
  return ok(result.data);
}

export async function fetchBotStats(): Promise<ApiResponse<BotStatsResponse>> {
  return botFetch('/api/bot/stats', BotStatsResponseSchema);
}

export async function fetchGuildOverview(
  guildId: string,
): Promise<ApiResponse<GuildOverviewResponse>> {
  return botFetch(`/api/bot/guilds/${guildId}/overview`, GuildOverviewResponseSchema);
}
