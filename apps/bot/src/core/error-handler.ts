import {
  AppError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from '@bot/shared/errors';
import type { ChatInputCommandInteraction } from 'discord.js';
import { replyError, replyWarning } from '../services/interaction-response.js';
import type { Logger } from '../utils/logger.js';

const NON_FATAL_CODES = new Set<string>([
  'VALIDATION_ERROR',
  'FORBIDDEN',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'RATE_LIMITED',
]);

/**
 * Decide whether an error should be reported as a non-fatal user error
 * (validation, permissions, rate limiting) or as a real internal error
 * (database failure, unexpected exception).
 */
export function isUserFacingError(err: unknown): boolean {
  if (err instanceof AppError) return NON_FATAL_CODES.has(err.code);
  return false;
}

function describe(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Unexpected error';
}

/**
 * Single entry point for handling errors raised by commands.  Always
 * attempts to reply to the user, and always logs the full error for
 * observability.  NEVER lets an unhandled error bubble up — Discord would
 * mark the interaction as failed without telling the user anything.
 */
export async function handleCommandError(
  err: unknown,
  interaction: ChatInputCommandInteraction,
  logger: Logger,
  ctx: { commandName: string },
): Promise<void> {
  if (err instanceof RateLimitError) {
    logger.warn('rate_limited', { commandName: ctx.commandName });
    await replyWarning(
      interaction,
      'Slow down',
      `Please wait a moment before using this command again.`,
    ).catch(() => undefined);
    return;
  }
  if (err instanceof ValidationError) {
    await replyError(interaction, 'Invalid input', describe(err)).catch(() => undefined);
    return;
  }
  if (err instanceof ForbiddenError || err instanceof UnauthorizedError) {
    await replyError(interaction, 'Permission denied', describe(err)).catch(() => undefined);
    return;
  }
  if (err instanceof NotFoundError) {
    await replyError(interaction, 'Not found', describe(err)).catch(() => undefined);
    return;
  }
  if (err instanceof AppError) {
    logger.error('command_error', err, { commandName: ctx.commandName, code: err.code });
    await replyError(interaction, 'Something went wrong', describe(err)).catch(() => undefined);
    return;
  }
  // Unknown error: log full stack, hide details from the user.
  logger.error('unhandled_command_error', err, { commandName: ctx.commandName });
  await replyError(
    interaction,
    'Something went wrong',
    'An unexpected error occurred. The incident has been logged.',
  ).catch(() => undefined);
}
