import { z } from 'zod';

/**
 * Discord permission flags as a bitfield.
 * Source: https://discord.com/developers/docs/topics/permissions#permissions-bitwise-permission-flags
 *
 * These are duplicated here (rather than re-exported from discord.js) so that
 * the web dashboard — which does NOT depend on discord.js — can reason about
 * permissions without pulling in the heavy client.
 */
export const DiscordPermission = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  VIEW_AUDIT_LOG: 1n << 7n,
  MODERATE_MEMBERS: 1n << 6n,
  MANAGE_MESSAGES: 1n << 13n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  MANAGE_NICKNAMES: 1n << 26n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_GUILD_EXPRESSIONS: 1n << 30n,
} as const;

export const DISCORD_SNOWFLEX_REGEX = /^\d{17,20}$/;

export const SnowflakeSchema = z
  .string()
  .regex(DISCORD_SNOWFLEX_REGEX, 'Invalid Discord snowflake');

export const GuildIdSchema = SnowflakeSchema.brand<'GuildId'>();
export const UserIdSchema = SnowflakeSchema.brand<'UserId'>();
export const ChannelIdSchema = SnowflakeSchema.brand<'ChannelId'>();
export const RoleIdSchema = SnowflakeSchema.brand<'RoleId'>();

export type GuildId = z.infer<typeof GuildIdSchema>;
export type UserId = z.infer<typeof UserIdSchema>;
export type ChannelId = z.infer<typeof ChannelIdSchema>;
export type RoleId = z.infer<typeof RoleIdSchema>;

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'pt-BR', 'ja'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
