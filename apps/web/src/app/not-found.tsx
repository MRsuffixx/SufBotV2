import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-4xl font-bold">Not found</h1>
      <p className="mt-3 max-w-md text-slate-600 dark:text-slate-300">
        The page you were looking for does not exist, or you do not have
        permission to view it.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Back to home
      </Link>
    </main>
  );
}
