import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionContext } from '../../lib/session';
import { listUserGuilds } from '../../lib/guilds';
import { getRateLimiter } from '../../lib/rate-limit';
import type { UserGuild } from '../../lib/guilds';

export const dynamic = 'force-dynamic';

export default async function DashboardIndexPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  const accessToken = session.discordAccessToken;
  if (!accessToken) {
    return <ReLinkCard username={session.user.username} />;
  }
  const ip = (await headers()).get('x-forwarded-for') ?? 'unknown';
  const limiter = getRateLimiter();
  if (!limiter.check(`dashboard:${session.user.id}:${ip}`).allowed) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        You are sending requests too quickly.  Please wait a moment and reload.
      </div>
    );
  }

  let guilds: UserGuild[];
  let loadError: string | null = null;
  try {
    guilds = await listUserGuilds(accessToken, session.user.id, ip);
  } catch (err) {
    guilds = [];
    loadError = err instanceof Error ? err.message : 'Failed to load guilds';
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">
          Welcome, {session.user.globalName ?? session.user.username}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Select a server below to manage its settings.  You only see servers
          where you have the <span className="font-mono">Manage Server</span>{' '}
          permission.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          Could not load your servers: {loadError}
        </div>
      ) : null}

      {guilds.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-semibold">No servers found</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            You don&apos;t appear to manage any server that has this bot
            installed.  Invite the bot to a server you own or administer, then
            refresh this page.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {guilds.map((g) => (
            <Link
              key={g.id}
              href={`/dashboard/${g.id}`}
              className="group flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-400 hover:shadow dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500"
            >
              {g.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={g.iconUrl}
                  alt={`${g.name} icon`}
                  className="h-12 w-12 flex-none rounded-md object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-brand-500 text-lg font-semibold text-white">
                  {g.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold group-hover:text-brand-600 dark:group-hover:text-brand-300">
                  {g.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {g.botPresent ? 'Bot is installed' : 'Bot not in server'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ReLinkCard({ username }: { username: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Welcome, {username}</h1>
      </header>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <h2 className="text-base font-semibold">Re-link your Discord account</h2>
        <p className="mt-2 text-sm">
          We could not decrypt your stored Discord access token.  Re-authorise
          the dashboard to continue.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Re-link with Discord
        </Link>
      </div>
    </div>
  );
}
