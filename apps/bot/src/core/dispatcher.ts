import {
  Events,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { hasAllPermissions } from '@bot/shared/permissions';
import type { BotContainer } from './container.js';
import type { CommandRegistry } from './command-registry.js';
import type { RateLimiter } from '../middleware/rate-limiter.js';
import { handleCommandError } from './error-handler.js';
import { replyError, replyWarning } from '../services/interaction-response.js';

export interface DispatcherDeps {
  container: BotContainer;
  registry: CommandRegistry;
  rateLimiter: RateLimiter;
}

/**
 * Wire the interactionCreate event to a single dispatcher that handles
 * rate limiting, permission checks, cooldowns, and error reporting.
 */
export function registerDispatcher(deps: DispatcherDeps): void {
  const { container, registry, rateLimiter } = deps;
  const client = container.client();
  const logger = container.logger().child({ component: 'dispatcher' });

  client.on(Events.InteractionCreate, async (raw) => {
    if (!raw.isChatInputCommand()) return;
    const interaction = raw as ChatInputCommandInteraction;
    const commandName = interaction.commandName;
    const command = registry.get(commandName);
    const log = logger.child({ commandName, userId: interaction.user.id });

    if (!command) {
      log.warn('unknown_command');
      return;
    }

    try {
      // 1. Rate limit per user.
      rateLimiter.consume(`user:${interaction.user.id}`);

      // 2. Cooldown per command per user.
      if (command.cooldown && command.cooldown > 0) {
        const cd = registry.isOnCooldown(commandName, interaction.user.id);
        if (cd.onCooldown) {
          await replyWarning(
            interaction,
            'Cooldown',
            `This command is on cooldown. Try again in ${Math.ceil(cd.remainingMs / 1000)}s.`,
          );
          return;
        }
        registry.setCooldown(commandName, interaction.user.id, command.cooldown);
      }

      // 3. DM check.
      if (!command.dmEnabled && !interaction.guildId) {
        await replyError(
          interaction,
          'Guild only',
          'This command can only be used inside a server.',
        );
        return;
      }

      // 4. Permission check.
      if (command.requiredPermissions && command.requiredPermissions.length > 0) {
        if (!interaction.guildId || !interaction.member) {
          await replyError(
            interaction,
            'Permission denied',
            'This command can only be used inside a server.',
          );
          return;
        }
        const memberPerms = (interaction.member as { permissions?: { bitfield?: string | number | bigint } })
          .permissions;
        const bitfield = memberPerms?.bitfield;
        if (bitfield == null) {
          await replyError(
            interaction,
            'Permission denied',
            'Unable to determine your permissions in this server.',
          );
          return;
        }
        if (!hasAllPermissions(bitfield, command.requiredPermissions)) {
          await replyError(
            interaction,
            'Permission denied',
            'You do not have the required permissions to use this command.',
          );
          return;
        }
      }

      // 5. Defer reply for commands that may take time.
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => undefined);
      }

      await command.execute(interaction, { container, logger: log });
    } catch (err) {
      await handleCommandError(err, interaction, log, { commandName });
    }
  });
}

// Re-export so the loader can import everything from one place
export { Events };
