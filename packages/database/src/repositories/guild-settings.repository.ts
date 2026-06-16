import type { GuildSettings, Prisma } from '@prisma/client';
import { prisma } from '../client.js';
import { GUILD_SETTINGS_DEFAULTS } from '@bot/shared/guild-settings';

export interface UpdateGuildSettingsInput {
  prefix?: string;
  welcomeChannelId?: string | null;
  logChannelId?: string | null;
  language?: string;
  features?: Prisma.InputJsonValue;
}

export const guildSettingsRepository = {
  async getOrCreate(guildId: string): Promise<GuildSettings> {
    const existing = await prisma.guildSettings.findUnique({ where: { guildId } });
    if (existing) return existing;
    return prisma.guildSettings.create({
      data: {
        guildId,
        prefix: GUILD_SETTINGS_DEFAULTS.prefix,
        language: GUILD_SETTINGS_DEFAULTS.language,
      },
    });
  },

  async findByGuildId(guildId: string): Promise<GuildSettings | null> {
    return prisma.guildSettings.findUnique({ where: { guildId } });
  },

  async update(
    guildId: string,
    input: UpdateGuildSettingsInput,
  ): Promise<GuildSettings> {
    await this.getOrCreate(guildId);
    const data: Prisma.GuildSettingsUpdateInput = {};
    if (input.prefix !== undefined) data.prefix = input.prefix;
    if (input.welcomeChannelId !== undefined) {
      data.welcomeChannelId = input.welcomeChannelId;
    }
    if (input.logChannelId !== undefined) {
      data.logChannelId = input.logChannelId;
    }
    if (input.language !== undefined) data.language = input.language;
    if (input.features !== undefined) data.features = input.features;
    return prisma.guildSettings.update({ where: { guildId }, data });
  },
};
