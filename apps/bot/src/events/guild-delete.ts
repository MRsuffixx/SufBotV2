import { Events, type Guild } from 'discord.js';
import { guildRepository } from '@bot/database';
import type { EventModule } from '../types/modules.js';

export const event: EventModule = {
  name: Events.GuildDelete,
  async execute(guild: Guild) {
    try {
      await guildRepository.markLeft(guild.id);
    } catch {
      // log only — never throw from event listeners
    }
  },
};

export default event;
