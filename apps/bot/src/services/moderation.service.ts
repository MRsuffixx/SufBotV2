import {
  DiscordPermission,
  hasPermission,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@bot/shared';
import { warningRepository, type CreateWarningInput } from '@bot/database';
import type { Warning } from '@prisma/client';
import { auditService } from './audit.service.js';

export interface WarnUserInput {
  guildId: string;
  userId: string;
  issuerId: string;
  reason: string;
  severity?: number;
}

export interface KickUserInput {
  guildId: string;
  userId: string;
  issuerId: string;
  reason: string;
}

export interface BanUserInput {
  guildId: string;
  userId: string;
  issuerId: string;
  reason: string;
  deleteMessageSeconds?: number;
}

const MAX_REASON_LENGTH = 512;
const MAX_SEVERITY = 5;
const MIN_DELETE_SECONDS = 0;
const MAX_DELETE_SECONDS = 7 * 24 * 60 * 60;

function validateReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length === 0) throw new ValidationError('Reason cannot be empty');
  if (trimmed.length > MAX_REASON_LENGTH) {
    throw new ValidationError(`Reason must be ${MAX_REASON_LENGTH} characters or fewer`);
  }
  return trimmed;
}

function validateSnowflake(id: string, label: string): void {
  if (!/^\d{17,20}$/.test(id)) throw new ValidationError(`Invalid ${label}`);
}

/**
 * High-level moderation operations.  These are the *only* place that
 * orchestrates Discord.js API calls combined with database writes.  Keeping
 * the logic in one service makes it easy to add new moderation actions and
 * to test them in isolation.
 *
 * The methods are permission-checked: callers must pass the issuer's
 * effective guild permissions and the bot's own permissions.  Throwing on
 * permission mismatches prevents privilege escalation if a command forgets
 * to check.
 */
export const moderationService = {
  /**
   * Issue a warning.  Returns the persisted warning.
   */
  async warn(
    input: WarnUserInput,
    ctx: { issuerPermissions: bigint },
  ): Promise<Warning> {
    validateSnowflake(input.guildId, 'guild id');
    validateSnowflake(input.userId, 'user id');
    validateSnowflake(input.issuerId, 'issuer id');
    if (!hasPermission(ctx.issuerPermissions, DiscordPermission.MODERATE_MEMBERS)) {
      throw new ForbiddenError('You need the Moderate Members permission to warn users');
    }
    const reason = validateReason(input.reason);
    const severity = input.severity ?? 0;
    const boundedSeverity = Math.max(0, Math.min(MAX_SEVERITY, severity));
    const data: CreateWarningInput = {
      guildId: input.guildId,
      userId: input.userId,
      issuerId: input.issuerId,
      reason,
      severity: boundedSeverity,
    };
    const warning = await warningRepository.create(data);
    await auditService.record({
      guildId: input.guildId,
      actorId: input.issuerId,
      action: 'moderation.warn',
      description: `Warned <@${input.userId}>: ${reason}`,
      metadata: { userId: input.userId, severity: boundedSeverity },
    });
    return warning;
  },

  async listWarnings(guildId: string, userId: string): Promise<Warning[]> {
    validateSnowflake(guildId, 'guild id');
    validateSnowflake(userId, 'user id');
    return warningRepository.listForUser(guildId, userId);
  },

  async countWarnings(guildId: string, userId: string): Promise<number> {
    validateSnowflake(guildId, 'guild id');
    validateSnowflake(userId, 'user id');
    return warningRepository.countForUser(guildId, userId);
  },

  /**
   * Kick a user.  Returns the reason that was recorded.  The actual API
   * call is performed by the calling command — this method only handles
   * authorisation and audit logging.
   */
  authorizeKick(
    input: KickUserInput,
    ctx: { issuerPermissions: bigint },
  ): { reason: string } {
    validateSnowflake(input.guildId, 'guild id');
    validateSnowflake(input.userId, 'user id');
    validateSnowflake(input.issuerId, 'issuer id');
    if (!hasPermission(ctx.issuerPermissions, DiscordPermission.KICK_MEMBERS)) {
      throw new ForbiddenError('You need the Kick Members permission to kick users');
    }
    if (input.userId === input.issuerId) {
      throw new ValidationError('You cannot kick yourself');
    }
    return { reason: validateReason(input.reason) };
  },

  authorizeBan(
    input: BanUserInput,
    ctx: { issuerPermissions: bigint; botPermissions: bigint },
  ): { reason: string; deleteMessageSeconds: number } {
    validateSnowflake(input.guildId, 'guild id');
    validateSnowflake(input.userId, 'user id');
    validateSnowflake(input.issuerId, 'issuer id');
    if (!hasPermission(ctx.issuerPermissions, DiscordPermission.BAN_MEMBERS)) {
      throw new ForbiddenError('You need the Ban Members permission to ban users');
    }
    if (!hasPermission(ctx.botPermissions, DiscordPermission.BAN_MEMBERS)) {
      throw new ForbiddenError('I do not have permission to ban members');
    }
    if (input.userId === input.issuerId) {
      throw new ValidationError('You cannot ban yourself');
    }
    const reason = validateReason(input.reason);
    const deleteMessageSeconds = Math.max(
      MIN_DELETE_SECONDS,
      Math.min(MAX_DELETE_SECONDS, input.deleteMessageSeconds ?? 0),
    );
    return { reason, deleteMessageSeconds };
  },

  async recordBan(input: BanUserInput): Promise<void> {
    await auditService.record({
      guildId: input.guildId,
      actorId: input.issuerId,
      action: 'moderation.ban',
      description: `Banned <@${input.userId}>: ${input.reason}`,
      metadata: { userId: input.userId },
    });
  },

  async recordKick(input: KickUserInput): Promise<void> {
    await auditService.record({
      guildId: input.guildId,
      actorId: input.issuerId,
      action: 'moderation.kick',
      description: `Kicked <@${input.userId}>: ${input.reason}`,
      metadata: { userId: input.userId },
    });
  },

  async rescindWarning(id: string, by: string): Promise<Warning> {
    if (typeof id !== 'string' || id.length === 0) {
      throw new ValidationError('Invalid warning id');
    }
    validateSnowflake(by, 'user id');
    try {
      const warning = await warningRepository.rescind(id, by);
      await auditService.record({
        guildId: warning.guildId,
        actorId: by,
        action: 'moderation.warn.rescind',
        description: `Rescinded warning ${id} for <@${warning.userId}>`,
      });
      return warning;
    } catch {
      throw new NotFoundError('Warning not found');
    }
  },
};
