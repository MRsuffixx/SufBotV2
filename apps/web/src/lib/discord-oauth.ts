import { z } from 'zod';
import { getWebEnv } from './env';

const DISCORD_API = 'https://discord.com/api/v10';

const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().optional(),
  scope: z.string(),
});

const UserResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  global_name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  discriminator: z.string().optional(),
  email: z.string().email().nullable().optional(),
  bot: z.boolean().optional(),
});

const GuildMemberResponseSchema = z.object({
  roles: z.array(z.string()).optional(),
});

const GuildPartialSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable().optional(),
  owner: z.boolean().optional(),
  permissions: z.string().optional(),
  features: z.array(z.string()).optional(),
});

const GuildsResponseSchema = z.array(GuildPartialSchema);

export interface DiscordTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scopes: string[];
}

export interface DiscordUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  email: string | null;
}

export interface DiscordGuildPartial {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  permissionsBitfield: bigint;
}

function avatarUrl(userId: string, avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  // Avatars can be static or animated.  We always request the animated
  // variant when possible, falling back to the static URL.
  const ext = avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}`;
}

function guildIconUrl(guildId: string, icon: string | null | undefined): string | null {
  if (!icon) return null;
  const ext = icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}`;
}

export function buildAuthorizeUrl(state: string): string {
  const env = getWebEnv();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.DISCORD_WEB_CLIENT_ID,
    scope: env.OAUTH_SCOPES.join(' '),
    redirect_uri: `${env.WEB_BASE_URL}/api/auth/callback`,
    state,
    prompt: 'consent',
  });
  return `${DISCORD_API}/oauth2/authorize?${params.toString()}`;
}

async function postForm<T>(path: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(`${DISCORD_API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord API error ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

async function authedGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${DISCORD_API}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord API error ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function exchangeCode(code: string): Promise<DiscordTokens> {
  const env = getWebEnv();
  const raw = await postForm<unknown>('/oauth2/token', {
    client_id: env.DISCORD_WEB_CLIENT_ID,
    client_secret: env.DISCORD_WEB_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${env.WEB_BASE_URL}/api/auth/callback`,
  });
  const parsed = TokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('Invalid token response from Discord');
  }
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? null,
    expiresAt: Date.now() + parsed.data.expires_in * 1000,
    scopes: parsed.data.scope.split(/\s+/u).filter(Boolean),
  };
}

export async function fetchCurrentUser(accessToken: string): Promise<DiscordUser> {
  const raw = await authedGet<unknown>(accessToken, '/users/@me');
  const parsed = UserResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid user response from Discord');
  return {
    id: parsed.data.id,
    username: parsed.data.username,
    globalName: parsed.data.global_name ?? null,
    avatarUrl: avatarUrl(parsed.data.id, parsed.data.avatar ?? null),
    email: parsed.data.email ?? null,
  };
}

export async function fetchGuilds(accessToken: string): Promise<DiscordGuildPartial[]> {
  const raw = await authedGet<unknown>(accessToken, '/users/@me/guilds');
  const parsed = GuildsResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid guilds response from Discord');
  return parsed.data.map((g) => ({
    id: g.id,
    name: g.name,
    iconUrl: guildIconUrl(g.id, g.icon ?? null),
    owner: g.owner ?? false,
    permissionsBitfield: BigInt(g.permissions ?? '0'),
  }));
}

/**
 * Fetch the caller's membership in a single guild.  Returns null if the
 * user is not a member.
 */
export async function fetchGuildMember(
  accessToken: string,
  guildId: string,
): Promise<{ roles: string[] } | null> {
  try {
    const raw = await authedGet<unknown>(accessToken, `/users/@me/guilds/${guildId}/member`);
    const parsed = GuildMemberResponseSchema.safeParse(raw);
    if (!parsed.success) return null;
    return { roles: parsed.data.roles ?? [] };
  } catch {
    return null;
  }
}
