import { Events, type Guild } from 'discord.js';
import { guildRepository } from '@bot/database';
import type { EventModule } from '../types/modules.js';

export const event: EventModule = {
  name: Events.GuildCreate,
  async execute(guild: Guild) {
    try {
      await guildRepository.upsert({
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconURL({ size: 64 }),
        memberCount: guild.memberCount ?? 0,
      });
    } catch {
      // log only — never throw from event listeners
    }
  },
};

export default event;
