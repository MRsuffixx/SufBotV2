import { GuildSettingsUpdateSchema, type GuildSettingsUpdate } from '@bot/shared/api';
import { GUILD_SETTINGS_DEFAULTS, GUILD_SETTINGS_LIMITS } from '@bot/shared/guild-settings';
import { ValidationError } from '@bot/shared/errors';
import { guildSettingsRepository, type UpdateGuildSettingsInput } from '@bot/database';
import type { GuildSettings } from '@prisma/client';

export const guildSettingsService = {
  async get(guildId: string): Promise<GuildSettings> {
    if (!/^\d{17,20}$/.test(guildId)) {
      throw new ValidationError('Invalid guild id');
    }
    return guildSettingsRepository.getOrCreate(guildId);
  },

  async update(guildId: string, input: GuildSettingsUpdate): Promise<GuildSettings> {
    if (!/^\d{17,20}$/.test(guildId)) {
      throw new ValidationError('Invalid guild id');
    }
    const parsed = GuildSettingsUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid guild settings',
        parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      );
    }
    const data: UpdateGuildSettingsInput = {};
    const p = parsed.data;
    if (p.prefix !== undefined) {
      if (
        p.prefix.length < GUILD_SETTINGS_LIMITS.prefixMinLength ||
        p.prefix.length > GUILD_SETTINGS_LIMITS.prefixMaxLength
      ) {
        throw new ValidationError(
          `Prefix must be between ${GUILD_SETTINGS_LIMITS.prefixMinLength} and ${GUILD_SETTINGS_LIMITS.prefixMaxLength} characters`,
        );
      }
      data.prefix = p.prefix;
    }
    if (p.welcomeChannelId !== undefined) data.welcomeChannelId = p.welcomeChannelId;
    if (p.logChannelId !== undefined) data.logChannelId = p.logChannelId;
    if (p.language !== undefined) data.language = p.language;
    return guildSettingsRepository.update(guildId, data);
  },

  defaults(): typeof GUILD_SETTINGS_DEFAULTS {
    return GUILD_SETTINGS_DEFAULTS;
  },
};
