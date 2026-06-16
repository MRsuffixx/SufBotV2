import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { prisma } from '@bot/database';
import { BotContainer } from './container.js';
import { TOKENS } from './symbols.js';
import { CommandRegistry } from './command-registry.js';
import { RateLimiter } from '../middleware/rate-limiter.js';
import { getLogger, setLogger, Logger } from '../utils/logger.js';
import { loadEnv, type BotEnv } from '../config/env.js';
import { loadCommands, loadEvents, loadModules } from './loader.js';
import { registerDispatcher } from './dispatcher.js';
import {
  auditService,
  botStatsService,
  guildSettingsService,
  moderationService,
} from '../services/index.js';

const VERSION = '0.1.0';

export interface BootOptions {
  env?: NodeJS.ProcessEnv;
  logger?: Logger;
  baseDir?: string;
}

/**
 * Build the DI container, wire core services, and return the assembled
 * components.  This function is intentionally side-effect-free aside from
 * service registration: the caller decides when to log in, when to load
 * commands, etc.
 */
export function buildContainer(opts: BootOptions = {}): {
  container: BotContainer;
  client: Client;
  registry: CommandRegistry;
  env: BotEnv;
} {
  const env = loadEnv(opts.env ?? process.env);
  const logger = opts.logger ?? getLogger();
  if (opts.logger) setLogger(opts.logger);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    rest: { retries: 3, timeout: 15_000 },
  });

  const registry = new CommandRegistry();
  const rateLimiter = new RateLimiter();

  const container = new BotContainer();
  container.register(TOKENS.Logger, () => logger);
  container.register<Client>(TOKENS.Client, () => client);
  container.register(TOKENS.Database, () => prisma);
  container.register<BotEnv>(TOKENS.Config, () => env);
  container.register(TOKENS.CommandRegistry, () => registry);
  container.register(TOKENS.RateLimiter, () => rateLimiter);
  container.register(TOKENS.AuditService, () => auditService);
  container.register(TOKENS.GuildSettingsService, () => guildSettingsService);
  container.register(TOKENS.ModerationService, () => moderationService);
  container.register(TOKENS.BotStatsService, () => botStatsService);

  return { container, client, registry, env };
}

/**
 * Login to Discord, register slash commands, and load all events/commands.
 * Returns a shutdown function the caller can use to gracefully stop the bot.
 */
export async function startBot(opts: BootOptions = {}): Promise<() => Promise<void>> {
  const { container, client, registry, env } = buildContainer(opts);
  const logger = container.logger().child({ component: 'boot' });
  const baseDir = opts.baseDir ?? new URL('..', import.meta.url).pathname;

  // 1. Wire the dispatcher (registers an interactionCreate listener).
  registerDispatcher({ container, registry, rateLimiter: container.get(TOKENS.RateLimiter) });

  // 2. Load events first so we can react to lifecycle events fired by login.
  const events = await loadEvents({ container, registry, baseDir });
  logger.info(`Loaded ${events.length} event(s)`);

  // 3. Load commands and module-level features.
  const commands = await loadCommands({ container, registry, baseDir });
  logger.info(`Loaded ${commands.length} command(s)`);
  const modules = await loadModules({ container, registry, baseDir });
  logger.info(`Loaded ${modules.length} module(s)`);

  // 4. Register slash commands with Discord REST.
  await registerSlashCommands({ client, env, commands: commands.map((c) => c.data) });

  // 5. Log in.
  await client.login(env.DISCORD_TOKEN);
  logger.info('Bot is online', {
    user: client.user?.tag,
    guilds: client.guilds.cache.size,
  });

  // 6. Return a shutdown hook.
  return async function shutdown(): Promise<void> {
    logger.info('Shutting down');
    try {
      for (const m of modules) {
        const maybePromise = m.shutdown?.(container);
        if (maybePromise && typeof maybePromise.catch === 'function') {
          await maybePromise.catch((err: unknown) =>
            logger.error(`Module "${m.id}" shutdown failed`, err),
          );
        }
      }
      await client.destroy();
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  };
}

/**
 * Push the slash command definitions to Discord.  In development we
 * register per-guild for instant updates; in production we register
 * globally.
 */
async function registerSlashCommands(args: {
  client: Client;
  env: BotEnv;
  commands: unknown[];
}): Promise<void> {
  const { client, env, commands } = args;
  if (commands.length === 0) return;
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const body = commands.map((c) => (c as { toJSON?: () => unknown }).toJSON?.() ?? c);

  if (env.DEV_GUILD_IDS.length > 0) {
    for (const guildId of env.DEV_GUILD_IDS) {
      // eslint-disable-next-line no-await-in-loop
      await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), {
        body,
      });
    }
    return;
  }
  await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body });
}
