import { NextResponse, type NextRequest } from 'next/server';
import {
  consumeOAuthState,
  createSession,
  setSessionCookie,
} from '../../../../lib/session';
import { exchangeCode, fetchCurrentUser } from '../../../../lib/discord-oauth';
import { userRepository, auditLogRepository } from '@bot/database';
import { ValidationError } from '@bot/shared/errors';

export const dynamic = 'force-dynamic';

/**
 * Discord OAuth2 callback.  Validates the CSRF state, exchanges the
 * authorization code for an access token, fetches the user's profile,
 * upserts the user record, and creates a session.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, req.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=missing_code', req.url));
  }

  const stateOk = await consumeOAuthState(state);
  if (!stateOk) {
    return NextResponse.redirect(new URL('/login?error=invalid_state', req.url));
  }

  try {
    const tokens = await exchangeCode(code);
    const discordUser = await fetchCurrentUser(tokens.accessToken);

    await userRepository.upsert({
      id: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.globalName,
      avatarUrl: discordUser.avatarUrl,
      // We don't request the `email` scope by default; if it's missing
      // we simply leave the existing email untouched.
      email: undefined,
    });

    const { token, expiresAt } = await createSession({
      userId: discordUser.id,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') ?? null,
      discordAccessToken: tokens.accessToken,
      discordAccessTokenExpiresAt: tokens.expiresAt,
    });
    await setSessionCookie(token, expiresAt);

    await auditLogRepository
      .record({
        actorId: discordUser.id,
        action: 'auth.login',
        description: `User ${discordUser.username} (${discordUser.id}) logged in`,
        source: 'web',
      })
      .catch(() => undefined);

    return NextResponse.redirect(new URL('/dashboard', req.url));
  } catch (err) {
    const message = err instanceof ValidationError ? err.message : 'login_failed';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, req.url));
  }
}
