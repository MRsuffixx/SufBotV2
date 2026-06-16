import { redirect } from 'next/navigation';
import { getCurrentUser, setOAuthStateCookie } from '../../lib/session';
import { buildAuthorizeUrl } from '../../lib/discord-oauth';
import { getWebEnv } from '../../lib/env';

export const dynamic = 'force-dynamic';

/**
 * Initiates the Discord OAuth2 authorization-code flow.  Stores a CSRF
 * state token in a short-lived HttpOnly cookie, then redirects the
 * browser to Discord.
 */
export default async function LoginPage(): Promise<never> {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');
  // Touch env to fail fast if configuration is missing.
  getWebEnv();
  const state = await setOAuthStateCookie();
  redirect(buildAuthorizeUrl(state));
}
