import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Process-wide Prisma client.  Reusing a single instance avoids exhausting
 * the database connection pool — Prisma holds a connection per client.
 *
 * In development the client is stored on `globalThis` so that hot-reload
 * does not create a new client (and a new pool) on every change.
 */
export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export type { PrismaClient } from '@prisma/client';
export { Prisma } from '@prisma/client';
