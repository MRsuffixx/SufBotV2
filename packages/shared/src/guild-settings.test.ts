import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANGUAGE,
  GUILD_SETTINGS_DEFAULTS,
  GUILD_SETTINGS_LIMITS,
  SUPPORTED_LANGUAGE_LIST,
} from './guild-settings.js';

describe('GuildSettings constants', () => {
  it('exposes reasonable defaults', () => {
    expect(GUILD_SETTINGS_DEFAULTS.prefix).toBe('!');
    expect(GUILD_SETTINGS_DEFAULTS.language).toBe('en');
    expect(GUILD_SETTINGS_DEFAULTS.welcomeChannelId).toBeNull();
    expect(GUILD_SETTINGS_DEFAULTS.logChannelId).toBeNull();
  });

  it('default language is en', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('prefix length is bounded', () => {
    expect(GUILD_SETTINGS_LIMITS.prefixMinLength).toBe(1);
    expect(GUILD_SETTINGS_LIMITS.prefixMaxLength).toBeGreaterThanOrEqual(1);
    expect(GUILD_SETTINGS_LIMITS.prefixMaxLength).toBeLessThanOrEqual(16);
  });

  it('supported language list is non-empty and includes English', () => {
    expect(SUPPORTED_LANGUAGE_LIST.length).toBeGreaterThan(0);
    expect(SUPPORTED_LANGUAGE_LIST).toContain('en');
  });
});
