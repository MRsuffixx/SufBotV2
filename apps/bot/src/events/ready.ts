import { Events, type Client } from 'discord.js';
import { guildRepository } from '@bot/database';
import type { EventModule } from '../types/modules.js';

async function onReady(client: Client): Promise<void> {
  // Sync guild metadata.  This is intentionally best-effort: a sync failure
  // should never crash the bot.
  try {
    const guilds = client.guilds.cache;
    for (const [, guild] of guilds) {
      await guildRepository
        .upsert({
          id: guild.id,
          name: guild.name,
          iconUrl: guild.iconURL({ size: 64 }),
          memberCount: guild.memberCount ?? 0,
        })
        .catch(() => undefined);
    }
  } catch {
    // ignore — log at the dispatcher
  }
  // eslint-disable-next-line no-console
  console.log(`[ready] Logged in as ${client.user?.tag} — ${client.guilds.cache.size} guild(s)`);
}

export const event: EventModule = {
  name: Events.ClientReady,
  once: true,
  execute: onReady as unknown as EventModule['execute'],
};

export default event;
