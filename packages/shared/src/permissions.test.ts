import { describe, expect, it } from 'vitest';
import {
  DiscordPermission,
} from './discord.js';
import {
  canManageGuild,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from './permissions.js';

describe('permissions', () => {
  it('detects a single permission bit', () => {
    const value = DiscordPermission.KICK_MEMBERS;
    expect(hasPermission(value, DiscordPermission.KICK_MEMBERS)).toBe(true);
    expect(hasPermission(value, DiscordPermission.BAN_MEMBERS)).toBe(false);
  });

  it('detects all required bits', () => {
    const value = DiscordPermission.KICK_MEMBERS | DiscordPermission.BAN_MEMBERS;
    expect(hasAllPermissions(value, [DiscordPermission.KICK_MEMBERS])).toBe(true);
    expect(
      hasAllPermissions(value, [
        DiscordPermission.KICK_MEMBERS,
        DiscordPermission.BAN_MEMBERS,
      ]),
    ).toBe(true);
    expect(
      hasAllPermissions(value, [
        DiscordPermission.KICK_MEMBERS,
        DiscordPermission.MODERATE_MEMBERS,
      ]),
    ).toBe(false);
  });

  it('detects any required bit', () => {
    const value = DiscordPermission.KICK_MEMBERS;
    expect(hasAnyPermission(value, [DiscordPermission.KICK_MEMBERS])).toBe(true);
    expect(
      hasAnyPermission(value, [DiscordPermission.BAN_MEMBERS, DiscordPermission.KICK_MEMBERS]),
    ).toBe(true);
    expect(hasAnyPermission(value, [DiscordPermission.BAN_MEMBERS])).toBe(false);
  });

  it('treats zero as no permissions', () => {
    expect(hasPermission(0n, DiscordPermission.ADMINISTRATOR)).toBe(false);
    expect(hasAllPermissions(0n, [])).toBe(true);
    expect(hasAnyPermission(0n, [])).toBe(false);
  });

  it('returns false for null/undefined bitfield', () => {
    expect(hasPermission(null, DiscordPermission.KICK_MEMBERS)).toBe(false);
    expect(hasPermission(undefined, DiscordPermission.KICK_MEMBERS)).toBe(false);
  });

  it('returns true for any permission when ADMINISTRATOR is set', () => {
    const admin = DiscordPermission.ADMINISTRATOR;
    expect(hasPermission(admin, DiscordPermission.KICK_MEMBERS)).toBe(true);
    expect(hasPermission(admin, DiscordPermission.BAN_MEMBERS)).toBe(true);
  });

  it('canManageGuild recognises MANAGE_GUILD', () => {
    expect(canManageGuild(DiscordPermission.MANAGE_GUILD)).toBe(true);
    expect(canManageGuild(DiscordPermission.KICK_MEMBERS)).toBe(false);
  });
});
