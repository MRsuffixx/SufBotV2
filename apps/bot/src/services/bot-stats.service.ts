import type { Client } from 'discord.js';

const startedAt = Date.now();

export interface BotStats {
  totalGuilds: number;
  totalUsers: number;
  uptimeSeconds: number;
  latencyMs: number;
  version: string;
}

/**
 * Read-only view of the bot's runtime state, suitable for dashboards and
 * healthchecks.  All numbers are computed on demand to avoid stale data.
 */
export const botStatsService = {
  collect(client: Client, version: string): BotStats {
    const totalUsers = client.guilds.cache.reduce(
      (sum, g) => sum + (g.memberCount ?? 0),
      0,
    );
    return {
      totalGuilds: client.guilds.cache.size,
      totalUsers,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      latencyMs: client.ws.ping,
      version,
    };
  },

  startedAt(): Date {
    return new Date(startedAt);
  },
};
