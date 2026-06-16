import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';
import type { AuthenticatedUser } from '../lib/session';
import type { BotStatsResponse } from '@bot/shared';

interface TopBarProps {
  user: AuthenticatedUser;
  stats: BotStatsResponse | null;
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

export function TopBar({ user, stats }: TopBarProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <h1 className="truncate text-base font-semibold">Bot Dashboard</h1>
        <div className="hidden items-center gap-2 sm:flex">
          <Pill
            label={stats ? `${stats.totalGuilds} servers` : 'offline'}
            tone={stats ? 'ok' : 'warn'}
          />
          <Pill label={stats ? `latency ${stats.latencyMs}ms` : '—'} tone="info" />
          <Pill
            label={stats ? `uptime ${formatUptime(stats.uptimeSeconds)}` : '—'}
            tone="info"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">
            {user.globalName ?? user.username}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Discord ID {user.id}</p>
        </div>
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="h-8 w-8 rounded-full"
          />
        ) : null}
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: 'ok' | 'info' | 'warn';
}) {
  const cls =
    tone === 'ok'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      : tone === 'warn'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

// Unused but exported for the import-preserving compiler.
export const __topbarLink: typeof Link = Link;
