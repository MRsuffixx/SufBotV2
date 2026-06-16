'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { GuildSettingsUpdateSchema } from '@bot/shared';
import { getSessionContext } from '../../../../lib/session';
import { canManageGuild } from '@bot/shared/permissions';
import { fetchUserGuildDetail } from '../../../../lib/guilds';
import { guildSettingsRepository, guildRepository, auditLogRepository } from '@bot/database';
import { fail, ok, fromError, type ApiResponse } from '../../../../lib/api-response';
import { getRateLimiter } from '../../../../lib/rate-limit';

const UpdateInputSchema = GuildSettingsUpdateSchema.extend({
  guildId: z.string().regex(/^\d{17,20}$/u),
});

export interface UpdateSettingsResponse {
  guildId: string;
  prefix: string;
  welcomeChannelId: string | null;
  logChannelId: string | null;
  language: string;
  updatedAt: string;
}

/**
 * Server action that updates a guild's settings from the dashboard.
 * Re-checks permissions on every call, validates the input, and writes
 * an audit log entry.
 */
export async function updateGuildSettings(
  rawInput: unknown,
): Promise<ApiResponse<UpdateSettingsResponse>> {
  const session = await getSessionContext();
  if (!session) return fail('Not authenticated');
  const accessToken = session.discordAccessToken;
  if (!accessToken) return fail('Discord session expired; please re-link');

  const parsed = UpdateInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
  const { guildId, ...patch } = parsed.data;

  const limiter = getRateLimiter();
  const decision = limiter.check(`update:${session.user.id}:${guildId}`);
  if (!decision.allowed) {
    return fail('Slow down — too many updates');
  }

  // Re-check Discord permissions: the user could have been demoted since
  // they loaded the page.
  let guildInfo: Awaited<ReturnType<typeof fetchUserGuildDetail>>;
  try {
    guildInfo = await fetchUserGuildDetail(accessToken, guildId);
  } catch (err) {
    return fromError(err);
  }
  if (!guildInfo.guild) return fail('Server not found');
  if (!guildInfo.manageable) {
    return fail('You no longer have permission to manage this server');
  }
  if (!canManageGuild(guildInfo.guild.permissionsBitfield)) {
    return fail('Insufficient permissions');
  }

  // Ensure the guild row exists so FK constraints on GuildSettings pass.
  await guildRepository
    .upsert({
      id: guildInfo.guild.id,
      name: guildInfo.guild.name,
      iconUrl: guildInfo.guild.iconUrl,
      memberCount: 0,
    })
    .catch(() => undefined);

  try {
    const updated = await guildSettingsRepository.update(guildId, patch);
    await auditLogRepository
      .record({
        guildId,
        actorId: session.user.id,
        action: 'settings.update',
        description: `Updated guild settings`,
        metadata: { patch },
        source: 'web',
      })
      .catch(() => undefined);
    revalidatePath(`/dashboard/${guildId}`);
    revalidatePath(`/dashboard/${guildId}/settings`);
    return ok({
      guildId: updated.guildId,
      prefix: updated.prefix,
      welcomeChannelId: updated.welcomeChannelId,
      logChannelId: updated.logChannelId,
      language: updated.language,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    return fromError(err);
  }
}
