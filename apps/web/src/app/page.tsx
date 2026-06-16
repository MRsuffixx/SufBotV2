import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../lib/session';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Discord Bot Dashboard
        </h1>
        <p className="mt-6 text-lg text-slate-600 dark:text-slate-300">
          Manage your guilds, change settings, and monitor your bot from a single
          control panel. Built for production use with structured logging,
          role-based access control, and full audit trails.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Sign in with Discord
          </Link>
        </div>
      </div>
    </main>
  );
}
