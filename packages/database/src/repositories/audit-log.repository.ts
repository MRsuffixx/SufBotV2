import type { AuditLog, Prisma } from '@prisma/client';
import { prisma } from '../client.js';

export interface RecordAuditLogInput {
  guildId?: string | null;
  actorId?: string | null;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  source?: 'bot' | 'web' | 'system';
}

const MAX_DESCRIPTION_LENGTH = 500;
const FORBIDDEN_KEYS = new Set(['token', 'secret', 'password', 'authorization']);

function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Prisma.InputJsonValue {
  if (!metadata) return {};
  const out: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) continue;
    if (value === null || value === undefined) {
      // skip nullish values
      continue;
    } else if (typeof value === 'string') {
      out[key] = value.length > 1024 ? `${value.slice(0, 1024)}…` : value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value as unknown as Prisma.InputJsonValue;
    } else if (typeof value === 'object') {
      out[key] = value as Prisma.InputJsonValue;
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

export const __sanitizeMetadata = sanitizeMetadata;

export const auditLogRepository = {
  async record(input: RecordAuditLogInput): Promise<AuditLog> {
    const description = input.description.slice(0, MAX_DESCRIPTION_LENGTH);
    return prisma.auditLog.create({
      data: {
        guildId: input.guildId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        description,
        metadata: sanitizeMetadata(input.metadata),
        source: input.source ?? 'system',
      },
    });
  },

  async listForGuild(guildId: string, limit = 50): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};
