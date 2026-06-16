import { cookies } from 'next/headers';
import {
  randomBytes,
  createHmac,
  timingSafeEqual,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { userRepository, sessionRepository, prisma } from '@bot/database';
import { getWebEnv } from './env';

const SESSION_COOKIE = 'session';
const STATE_COOKIE = 'oauth_state';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const STATE_COOKIE_NAME = STATE_COOKIE;

// scrypt is used to derive a 32-byte AES key from SESSION_SECRET.  The
// salt is constant because SESSION_SECRET is the actual entropy source;
// the salt only prevents key reuse across deployments that happen to
// share the same SESSION_SECRET.
const KDF_SALT = Buffer.from('discord-bot-ecosystem.session-key.v1', 'utf8');

function getAesKey(): Buffer {
  const env = getWebEnv();
  return scryptSync(env.SESSION_SECRET, KDF_SALT, 32);
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getAesKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

export function decryptToken(enc: string): string {
  const buf = Buffer.from(enc, 'base64url');
  if (buf.length < 12 + 16 + 1) throw new Error('Encrypted token is too short');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', getAesKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function signToken(token: string): string {
  const env = getWebEnv();
  return createHmac('sha256', env.SESSION_SECRET).update(token).digest('base64url');
}

function verifyToken(token: string, signature: string): boolean {
  const expected = signToken(token);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * The value stored in the session cookie.  `<token>.<signature>` where
 * the signature is an HMAC of the token.  The DB stores only a hash of
 * the token so neither the database nor a stolen cookie alone is enough
 * to authenticate.
 */
function pack(token: string): string {
  return `${token}.${signToken(token)}`;
}

function unpack(value: string): string | null {
  const idx = value.lastIndexOf('.');
  if (idx <= 0) return null;
  const token = value.slice(0, idx);
  const signature = value.slice(idx + 1);
  if (!verifyToken(token, signature)) return null;
  return token;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
}

export interface SessionWithTokens {
  user: AuthenticatedUser;
  sessionId: string;
  /**
   * The decrypted Discord access token.  Null if the session was created
   * before this feature was added or if the token has been cleared.
   */
  discordAccessToken: string | null;
  /**
   * Expiry of the Discord access token, in ms since epoch.  Null if
   * the access token is null.
   */
  discordAccessTokenExpiresAt: number | null;
}

export async function createSession(input: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
  discordAccessToken?: string;
  discordAccessTokenExpiresAt?: number;
}): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const accessTokenEnc = input.discordAccessToken
    ? encryptToken(input.discordAccessToken)
    : null;
  const { session, token } = await sessionRepository.create({
    userId: input.userId,
    userAgent: input.userAgent ?? null,
    ip: input.ip ?? null,
    ttlMs: SESSION_TTL_MS,
    accessTokenEnc,
    accessTokenExpiresAt: input.discordAccessTokenExpiresAt
      ? new Date(input.discordAccessTokenExpiresAt)
      : null,
  });
  return { token, expiresAt: session.expiresAt, sessionId: session.id };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const jar = await cookies();
  const env = getWebEnv();
  const isProd = env.NODE_ENV === 'production';
  jar.set(SESSION_COOKIE, pack(token), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return unpack(raw);
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const ctx = await getSessionContext();
  return ctx?.user ?? null;
}

export async function getSessionContext(): Promise<SessionWithTokens | null> {
  const token = await readSessionToken();
  if (!token) return null;
  const session = await sessionRepository.findByToken(token);
  if (!session) return null;
  const user = await userRepository.findById(session.userId);
  if (!user) return null;
  let accessToken: string | null = null;
  if (session.accessTokenEnc) {
    try {
      accessToken = decryptToken(session.accessTokenEnc);
    } catch {
      // Corrupt or rotated key — treat as if the token is missing so
      // the user is forced to re-authenticate.
      accessToken = null;
    }
  }
  return {
    user: {
      id: user.id,
      username: user.username,
      globalName: user.globalName ?? null,
      avatarUrl: user.avatarUrl ?? null,
    },
    sessionId: session.id,
    discordAccessToken: accessToken,
    discordAccessTokenExpiresAt: session.accessTokenExpiresAt
      ? session.accessTokenExpiresAt.getTime()
      : null,
  };
}

export async function destroyCurrentSession(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    await sessionRepository.deleteByToken(token).catch(() => undefined);
  }
  await clearSessionCookie();
}

export async function setOAuthStateCookie(): Promise<string> {
  const state = randomBytes(24).toString('base64url');
  const jar = await cookies();
  const env = getWebEnv();
  const isProd = env.NODE_ENV === 'production';
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  });
  return state;
}

export async function consumeOAuthState(expected: string): Promise<boolean> {
  const jar = await cookies();
  const actual = jar.get(STATE_COOKIE)?.value;
  if (!actual) return false;
  if (actual.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return false;
  jar.delete(STATE_COOKIE);
  return true;
}

/**
 * Close any prisma connections that may have been opened by the auth
 * helpers.  Should be called from `after()` in route handlers to avoid
 * hanging requests in serverless deployments.
 */
export async function disposePrisma(): Promise<void> {
  await prisma.$disconnect().catch(() => undefined);
}
