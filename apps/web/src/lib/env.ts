import { z } from 'zod';
import { ConfigurationError } from '@bot/shared/errors';

const SnowflakeSchema = z.string().regex(/^\d{17,20}$/u, 'Invalid Discord snowflake');

const WebEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url(),
  WEB_BASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  DISCORD_WEB_CLIENT_ID: SnowflakeSchema,
  DISCORD_WEB_CLIENT_SECRET: z.string().min(10),
  OAUTH_SCOPES: z
    .string()
    .default('identify guilds')
    .transform((s) =>
      s
        .split(/\s+/u)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  WEB_ALLOWED_ORIGINS: z
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
  INTERNAL_API_TOKEN: z.string().min(16),
  BOT_API_BASE_URL: z.string().url().default('http://bot:3001'),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export type WebEnv = z.infer<typeof WebEnvSchema>;

let cached: WebEnv | undefined;

export function loadWebEnv(source: NodeJS.ProcessEnv = process.env): WebEnv {
  if (cached) return cached;
  const parsed = WebEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n  ');
    throw new ConfigurationError(`Invalid web environment:\n  ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function getWebEnv(): WebEnv {
  if (cached) return cached;
  return loadWebEnv();
}

export function __resetWebEnvForTest(): void {
  cached = undefined;
}
