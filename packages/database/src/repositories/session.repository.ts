import { createHash, randomBytes } from 'node:crypto';
import type { Session } from '@prisma/client';
import { prisma } from '../client.js';

export interface CreateSessionInput {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
  ttlMs: number;
}

export interface CreatedSession {
  session: Session;
  token: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip).digest('hex');
}

export const sessionRepository = {
  /**
   * Create a new session and return both the database row and the plain token.
   * The plain token is shown to the user exactly once (in a cookie) — only the
   * SHA-256 hash is persisted.
   */
  async create(input: CreateSessionInput): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const session = await prisma.session.create({
      data: {
        userId: input.userId,
        tokenHash,
        userAgent: input.userAgent ?? null,
        ipHash: hashIp(input.ip),
        expiresAt: new Date(Date.now() + input.ttlMs),
      },
    });
    return { session, token };
  },

  async findByToken(token: string): Promise<Session | null> {
    const tokenHash = hashToken(token);
    const session = await prisma.session.findUnique({ where: { tokenHash } });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }
    return session;
  },

  async deleteByToken(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await prisma.session
      .delete({ where: { tokenHash } })
      .catch(() => undefined);
  },

  async deleteExpired(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  },
};
