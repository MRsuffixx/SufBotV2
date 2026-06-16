import { SUPPORTED_LANGUAGES } from './discord.js';

export const GUILD_SETTINGS_DEFAULTS = {
  prefix: '!',
  language: 'en' as const,
  welcomeChannelId: null as string | null,
  logChannelId: null as string | null,
} as const;

export const GUILD_SETTINGS_LIMITS = {
  prefixMaxLength: 8,
  prefixMinLength: 1,
} as const;

export const DEFAULT_LANGUAGE = 'en' as const;

export const SUPPORTED_LANGUAGE_LIST: readonly string[] = SUPPORTED_LANGUAGES;
