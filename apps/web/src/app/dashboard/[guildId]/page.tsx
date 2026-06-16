import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getSessionContext } from '../../../lib/session';
import { fetchGuildOverview, fetchBotStats } from '../../../lib/bot-api';
import { fetchUserGuildDetail } from '../../../lib/guilds';
import { guildSettingsRepository, guildRepository } from '@bot/database';
import { GuildSettingsForm } from './settings/guild-settings-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ guildId: string }>;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

export default async function GuildDetailPage({ params }: PageProps) {
  const { guildId } = await params;
  if (!/^\d{17,20}$/u.test(guildId)) notFound();

  const session = await getSessionContext();
  if (!session) redirect('/login');
  const accessToken = session.discordAccessToken;
  if (!accessToken) redirect('/login');

  // 1. Confirm the user can manage this guild on Discord.
  const detail = await fetchUserGuildDetail(accessToken, guildId);
  if (!detail.guild || !detail.manageable) {
    return (
      <div className="mx-auto max-w-2xl rounded-md border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <h1 className="text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm">
          You do not have permission to manage this server, or it is not visible
          to your account.  If you believe this is wrong, re-link your Discord
          account.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center rounded-md border border-amber-400 px-3 py-1.5 text-sm font-medium hover:bg-amber-100 dark:border-amber-600 dark:hover:bg-amber-900/40"
        >
          ← Back to overview
        </Link>
      </div>
    );
  }

  // 2. Fetch bot stats + per-guild overview (best effort).
  const [statsResult, overviewResult] = await Promise.all([
    fetchBotStats(),
    fetchGuildOverview(guildId),
  ]);

  // 3. Hydrate settings.
  await guildRepository
    .upsert({
      id: detail.guild.id,
      name: detail.guild.name,
      iconUrl: detail.guild.iconUrl,
      memberCount: 0,
    })
    .catch(() => undefined);
  const settings = await guildSettingsRepository.getOrCreate(guildId);

  // 4. For the channel selector, we reuse the bot's guild cache (live
  // data) and fall back to nothing if the bot is not in the guild.
  const overview = overviewResult.success ? overviewResult.data : null;
  const textChannels = (overview?.textChannels ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    type: 'text' as const,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="flex items-center gap-4">
        {detail.guild.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail.guild.iconUrl}
            alt={detail.guild.name}
            className="h-16 w-16 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-brand-500 text-2xl font-bold text-white">
            {detail.guild.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold">{detail.guild.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ID {detail.guild.id}
            {detail.guild.owner ? ' • Owner' : ''}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Bot latency"
          value={statsResult.success && statsResult.data ? `${statsResult.data.latencyMs}ms` : '—'}
          tone={statsResult.success && statsResult.data ? 'ok' : 'warn'}
        />
        <StatCard
          label="Bot uptime"
          value={
            statsResult.success && statsResult.data
              ? formatUptime(statsResult.data.uptimeSeconds)
              : '—'
          }
        />
        <StatCard
          label="Member count"
          value={overview ? `${overview.memberCount}` : '—'}
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold">Bot status</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {overview
            ? 'The bot is connected to this server and synchronising its state.'
            : 'The bot is not currently a member of this server.  Invite it to start collecting data.'}
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Changes are saved immediately and picked up by the bot on its next
          interaction.
        </p>
        <div className="mt-6">
          <GuildSettingsForm
            guildId={guildId}
            initial={{
              prefix: settings.prefix,
              welcomeChannelId: settings.welcomeChannelId,
              logChannelId: settings.logChannelId,
              language: settings.language,
            }}
            channels={textChannels}
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'info',
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'info' | 'warn';
}) {
  const toneClass =
    tone === 'ok'
      ? 'text-emerald-600 dark:text-emerald-300'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-300'
        : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
