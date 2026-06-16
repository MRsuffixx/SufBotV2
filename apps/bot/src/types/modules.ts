import type {
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import type { Logger } from '../utils/logger.js';
import type { BotContainer } from '../core/container.js';

/**
 * The shared shape every slash command module must export as its default
 * export.  Commands are registered with the REST API and dispatched to by
 * the interactionCreate event.
 */
export interface CommandModule {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | ContextMenuCommandBuilder;
  /** Cooldown in seconds applied per user; 0 disables cooldowns. */
  cooldown?: number;
  /** Permissions the *executor* must have on the guild.  Empty = no check. */
  requiredPermissions?: bigint[];
  /** Whether the command can be used in DMs.  Default: false. */
  dmEnabled?: boolean;
  /** Optional metadata for documentation/discovery. */
  meta?: {
    category?: string;
    description?: string;
  };
  execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void> | void;
}

export interface CommandContext {
  container: BotContainer;
  logger: Logger;
}

/**
 * Every event module must export a `name` (the Discord.js event), `once`
 * flag, and an `execute` function.  Listeners are wired by the loader.
 */
export interface EventModule {
  name: string;
  once?: boolean;
  execute(...args: unknown[]): Promise<void> | void;
}

/**
 * Optional module that can run code when the bot boots (e.g. schedule
 * recurring jobs, register custom listeners).  Useful for plugin-like
 * features such as auto-moderation or analytics.
 */
export interface BotModule {
  id: string;
  init(container: BotContainer): Promise<void> | void;
  shutdown?(container: BotContainer): Promise<void> | void;
}
