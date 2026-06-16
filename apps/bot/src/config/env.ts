import { z } from 'zod';
import { ConfigurationError } from '@bot/shared/errors';

const SnowflakeSchema = z.string().regex(/^\d{17,20}$/u, 'Invalid Discord snowflake');

/**
 * Schema for the bot's environment.  Centralised so that the same validation
 * runs on startup and in tests, and so the type is exported from a single
 * place.
 */
export const BotEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  DISCORD_TOKEN: z.string().min(20, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: SnowflakeSchema,
  // Optional: client secret used for OAuth-bound actions (e.g. fetching the
  // bot's own guild list).  Not required for slash commands.
  DISCORD_BOT_CLIENT_SECRET: z.string().optional(),
  DEV_GUILD_IDS: z
    .string()
    .optional()
    .transform((s) =>
      s == null
        ? []
        : s
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
    ),
  DATABASE_URL: z.string().url(),
  BOT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  BOT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(10_000),
  /**
   * Port for the internal HTTP API the dashboard reads from.  Set to 0 to
   * disable the API.  When disabled, the dashboard will show stale data and
   * bot stats will be unavailable.
   */
  BOT_API_PORT: z.coerce.number().int().min(0).max(65535).default(0),
  /**
   * Shared secret required by the internal API.  Must match the value the
   * dashboard uses; otherwise the dashboard cannot reach the bot.
   */
  INTERNAL_API_TOKEN: z.string().min(16).optional(),
});

export type BotEnv = z.infer<typeof BotEnvSchema>;

let cached: BotEnv | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): BotEnv {
  const parsed = BotEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n  ');
    throw new ConfigurationError(`Invalid bot environment:\n  ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function getEnv(): BotEnv {
  if (!cached) cached = loadEnv();
  return cached;
}

/**
 * Test-only helper to reset the cache between tests.  Never call from
 * production code.
 */
export function __resetEnvForTest(): void {
  cached = undefined;
}
