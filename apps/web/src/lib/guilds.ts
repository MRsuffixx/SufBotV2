import { guildRepository, guildSettingsRepository, userRepository } from '@bot/database';
import { canManageGuild, DiscordPermission } from '@bot/shared';
import { fetchGuildMember, fetchGuilds, type DiscordGuildPartial } from './discord-oauth';
import { getRateLimiter } from './rate-limit';

export interface UserGuild {
  id: string;
  name: string;
  iconUrl: string | null;
  /** True if the user has MANAGE_GUILD (or is owner / admin). */
  manageable: boolean;
  /** True if the bot is known to be in this guild (from our database). */
  botPresent: boolean;
  /** Cached settings if the bot is in the guild. */
  settings: {
    prefix: string;
    welcomeChannelId: string | null;
    logChannelId: string | null;
    language: string;
    updatedAt: Date;
  } | null;
}

/**
 * Combine the Discord guilds the user belongs to with the bot's own
 * database to figure out which guilds can be managed from the dashboard.
 *
 * Discord's `/users/@me/guilds` payload returns the user's permissions as
 * a string bitfield; we re-use the same permission helpers as the bot.
 */
export async function listUserGuilds(
  accessToken: string,
  userId: string,
  ip: string,
): Promise<UserGuild[]> {
  const limiter = getRateLimiter();
  // Rate-limit per (user, ip) tuple so a single user can't blow the
  // Discord API rate limit.
  const decision = limiter.check(`guilds:${userId}:${ip}`);
  if (!decision.allowed) {
    throw new Error('Please slow down');
  }

  const [discordGuilds, dbGuilds] = await Promise.all([
    fetchGuilds(accessToken),
    guildRepository.listActive(),
  ]);
  const dbById = new Map(dbGuilds.map((g) => [g.id, g] as const));

  // Ensure the user row exists so future joins don't race.
  await userRepository.upsert({ id: userId, username: '' }).catch(() => undefined);

  const out: UserGuild[] = [];
  for (const g of discordGuilds) {
    const manageable = canManageGuild(g.permissionsBitfield);
    if (!manageable) continue;
    const dbGuild = dbById.get(g.id);
    let settings: UserGuild['settings'] = null;
    if (dbGuild) {
      const s = await guildSettingsRepository.findByGuildId(g.id).catch(() => null);
      if (s) {
        settings = {
          prefix: s.prefix,
          welcomeChannelId: s.welcomeChannelId,
          logChannelId: s.logChannelId,
          language: s.language,
          updatedAt: s.updatedAt,
        };
      }
    }
    out.push({
      id: g.id,
      name: g.name,
      iconUrl: g.iconUrl,
      manageable: true,
      botPresent: dbGuild !== undefined,
      settings,
    });
  }
  return out;
}

export async function fetchUserGuildDetail(
  accessToken: string,
  guildId: string,
): Promise<{
  guild: DiscordGuildPartial | null;
  manageable: boolean;
  member: { roles: string[] } | null;
}> {
  const guilds = await fetchGuilds(accessToken);
  const guild = guilds.find((g) => g.id === guildId) ?? null;
  if (!guild) {
    return { guild: null, manageable: false, member: null };
  }
  const manageable = canManageGuild(guild.permissionsBitfield);
  const member = manageable ? await fetchGuildMember(accessToken, guildId) : null;
  return { guild, manageable, member };
}

export function isAdminBit(bitfield: bigint | string | number): boolean {
  try {
    return (BigInt(bitfield) & DiscordPermission.ADMINISTRATOR) !== 0n;
  } catch {
    return false;
  }
}
