'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Dashboard error boundary', error);
  }, [error]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 max-w-md text-slate-600 dark:text-slate-300">
        An unexpected error occurred while rendering this page.  The incident has
        been logged.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
