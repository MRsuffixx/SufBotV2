import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/session';
import { Sidebar } from '../../components/sidebar';
import { TopBar } from '../../components/top-bar';
import { fetchBotStats } from '../../lib/bot-api';
import type { BotStatsResponse } from '@bot/shared';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Fetch bot stats once for the whole dashboard tree.  Children can
  // re-fetch per-guild data using their own server actions.
  const stats = await fetchBotStats();
  const initialStats: BotStatsResponse | null = stats.success && stats.data ? stats.data : null;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} stats={initialStats} />
        <main className="min-w-0 flex-1 overflow-y-auto p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
