import { z } from 'zod';
import { SUPPORTED_LANGUAGES, SnowflakeSchema } from './discord.js';

export const GuildSettingsUpdateSchema = z.object({
  prefix: z
    .string()
    .min(1, 'Prefix is required')
    .max(8, 'Prefix must be 8 characters or fewer')
    .regex(/^[^@#:`]*$/u, 'Prefix contains invalid characters')
    .optional(),
  welcomeChannelId: SnowflakeSchema.nullable().optional(),
  logChannelId: SnowflakeSchema.nullable().optional(),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
});
export type GuildSettingsUpdate = z.infer<typeof GuildSettingsUpdateSchema>;

export const GuildSettingsResponseSchema = z.object({
  guildId: SnowflakeSchema,
  prefix: z.string(),
  welcomeChannelId: SnowflakeSchema.nullable(),
  logChannelId: SnowflakeSchema.nullable(),
  language: z.enum(SUPPORTED_LANGUAGES),
  updatedAt: z.string().datetime(),
});
export type GuildSettingsResponse = z.infer<typeof GuildSettingsResponseSchema>;

export const GuildOverviewResponseSchema = z.object({
  guildId: SnowflakeSchema,
  name: z.string(),
  memberCount: z.number().int().nonnegative(),
  botLatencyMs: z.number().int().nonnegative(),
  uptimeSeconds: z.number().int().nonnegative(),
  textChannels: z
    .array(
      z.object({
        id: SnowflakeSchema,
        name: z.string(),
      }),
    )
    .optional(),
});
export type GuildOverviewResponse = z.infer<typeof GuildOverviewResponseSchema>;

export const TextChannelSchema = z.object({
  id: SnowflakeSchema,
  name: z.string(),
});
export type TextChannel = z.infer<typeof TextChannelSchema>;

export const BotStatsResponseSchema = z.object({
  totalGuilds: z.number().int().nonnegative(),
  totalUsers: z.number().int().nonnegative(),
  uptimeSeconds: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  version: z.string(),
});
export type BotStatsResponse = z.infer<typeof BotStatsResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
